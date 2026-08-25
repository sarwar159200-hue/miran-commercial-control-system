"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Paperclip, Search, Send, UserRound } from "lucide-react";

type ChatUser = {
  id: string;
  full_name?: string | null;
  preferred_name?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
};

type ChatDocument = {
  id: string;
  document_title?: string | null;
  file_name?: string | null;
  document_type?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
  attachment_document_id?: string | null;
};

function displayName(user?: ChatUser | null) {
  return user?.preferred_name?.trim() || user?.full_name?.trim() || "MCCS User";
}

function isOnline(user?: ChatUser | null) {
  if (!user?.last_seen_at) return false;
  const seen = new Date(user.last_seen_at).getTime();
  return Number.isFinite(seen) && Date.now() - seen < 120_000;
}

export default function MessagesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = useState("");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [documents, setDocuments] = useState<ChatDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [attachment, setAttachment] = useState("");
  const [errorText, setErrorText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = users.find((u) => u.id === selectedId) ?? null;
  const documentMap = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);

  const refreshUsers = useCallback(async (selfId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,preferred_name,avatar_url,last_seen_at")
      .neq("id", selfId)
      .order("full_name", { ascending: true });

    if (error) {
      setErrorText(`Unable to load users: ${error.message}`);
      return;
    }

    const list = Array.isArray(data) ? (data as ChatUser[]) : [];
    setUsers(list);
    setSelectedId((existing) => existing || list[0]?.id || "");
  }, [supabase]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }
        if (!active) return;

        setCurrentUserId(user.id);
        await refreshUsers(user.id);
        const requestedPartner = new URLSearchParams(window.location.search).get("user");
        if (requestedPartner) setSelectedId(requestedPartner);

        const [documentResult, vendorResult] = await Promise.all([
          supabase
            .from("documents")
            .select("id,document_title,file_name,document_type,vendor_id")
            .eq("is_deleted", false)
            .order("uploaded_at", { ascending: false })
            .limit(100),
          supabase
            .from("vendors")
            .select("id,vendor_name")
            .order("vendor_name", { ascending: true }),
        ]);

        if (!active) return;
        if (documentResult.error) {
          console.warn("MCCS chat document list:", documentResult.error.message);
          setDocuments([]);
        } else {
          const vendorMap = new Map(
            (Array.isArray(vendorResult.data) ? vendorResult.data : []).map((vendor: any) => [
              String(vendor.id),
              String(vendor.vendor_name || "Unknown Supplier / Contractor"),
            ])
          );
          const rows = (Array.isArray(documentResult.data) ? documentResult.data : []).map((document: any) => ({
            ...document,
            vendor_name: document.vendor_id
              ? vendorMap.get(String(document.vendor_id)) || "Unknown Supplier / Contractor"
              : "Unassigned",
          }));
          setDocuments(rows as ChatDocument[]);
        }
      } catch (error: any) {
        if (active) setErrorText(error?.message || "Unable to initialize Messages.");
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshUsers, supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    const timer = window.setInterval(() => void refreshUsers(currentUserId), 30_000);
    return () => window.clearInterval(timer);
  }, [currentUserId, refreshUsers]);

  const loadConversation = useCallback(async (partnerId: string) => {
    if (!currentUserId || !partnerId) {
      setMessages([]);
      return;
    }

    setErrorText("");
    try {
      // Two simple queries are intentionally used instead of one complex .or()
      // expression. This is more robust across PostgREST/Supabase versions.
      const [sentResult, receivedResult] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("id,sender_id,recipient_id,body,created_at,read_at,attachment_document_id")
          .eq("sender_id", currentUserId)
          .eq("recipient_id", partnerId)
          .order("created_at", { ascending: true })
          .limit(300),
        supabase
          .from("chat_messages")
          .select("id,sender_id,recipient_id,body,created_at,read_at,attachment_document_id")
          .eq("sender_id", partnerId)
          .eq("recipient_id", currentUserId)
          .order("created_at", { ascending: true })
          .limit(300),
      ]);

      if (sentResult.error) throw sentResult.error;
      if (receivedResult.error) throw receivedResult.error;

      const merged = [
        ...((sentResult.data ?? []) as ChatMessage[]),
        ...((receivedResult.data ?? []) as ChatMessage[]),
      ]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-300);

      setMessages(merged);

      const { error: readError } = await supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", partnerId)
        .eq("recipient_id", currentUserId)
        .is("read_at", null);

      if (readError) console.warn("MCCS mark chat read:", readError.message);
    } catch (error: any) {
      console.error("MCCS load conversation:", error);
      setMessages([]);
      setErrorText(error?.message || "Unable to open this conversation.");
    }
  }, [currentUserId, supabase]);

  useEffect(() => {
    if (!selectedId || !currentUserId) return;
    void loadConversation(selectedId);
  }, [selectedId, currentUserId, loadConversation]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`mccs-messages-page-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: any) => {
          const message = payload?.new as ChatMessage | undefined;
          if (!message || !selectedId) return;
          const belongsToOpenConversation =
            (message.sender_id === currentUserId && message.recipient_id === selectedId) ||
            (message.sender_id === selectedId && message.recipient_id === currentUserId);
          if (!belongsToOpenConversation) return;

          setMessages((existing) => {
            if (existing.some((row) => row.id === message.id)) return existing;
            return [...existing, message].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage() {
    const recipientId = selectedId;
    const body = text.trim();
    if (!currentUserId || !recipientId || (!body && !attachment)) return;

    setErrorText("");
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          sender_id: currentUserId,
          recipient_id: recipientId,
          body,
          attachment_document_id: attachment || null,
        })
        .select("id,sender_id,recipient_id,body,created_at,read_at,attachment_document_id")
        .single();

      if (error) throw error;
      setText("");
      setAttachment("");

      if (data) {
        const inserted = data as ChatMessage;
        setMessages((existing) =>
          existing.some((row) => row.id === inserted.id) ? existing : [...existing, inserted]
        );
      }
    } catch (error: any) {
      console.error("MCCS send message:", error);
      setErrorText(error?.message || "Message could not be sent.");
    }
  }

  const filteredUsers = users.filter((user) =>
    displayName(user).toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div>
      <div className="mb-5">
        <div className="text-xs font-extrabold uppercase tracking-[.18em] text-blue-700">Collaboration</div>
        <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Private MCCS chat. Normal messages are automatically removed after 7 days; shared Google Drive documents remain available.
        </p>
      </div>

      {errorText ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorText}
        </div>
      ) : null}

      <div className="grid min-h-[680px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[310px_1fr]">
        <aside className="border-r border-slate-200 p-4 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="mt-4 space-y-1">
            {filteredUsers.map((user) => (
              <button
                type="button"
                key={user.id}
                onClick={() => {
                  setErrorText("");
                  setSelectedId(user.id);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${
                  selectedId === user.id
                    ? "bg-blue-50 dark:bg-blue-950/40"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <UserRound className="m-2.5 h-6 w-6 text-slate-400" />
                  )}
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                      isOnline(user) ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{displayName(user)}</div>
                  <div className={`text-xs ${isOnline(user) ? "text-emerald-600" : "text-slate-400"}`}>
                    {isOnline(user) ? "Online" : "Offline"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          {selected ? (
            <>
              <header className="flex h-20 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-extrabold text-slate-950 dark:text-white">{displayName(selected)}</div>
                  <div className={`text-xs ${isOnline(selected) ? "text-emerald-600" : "text-slate-400"}`}>
                    {isOnline(selected) ? "Online now" : "Offline"}
                  </div>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-5 dark:bg-slate-900/30">
                {messages.map((message) => {
                  const mine = message.sender_id === currentUserId;
                  const document = message.attachment_document_id
                    ? documentMap.get(message.attachment_document_id)
                    : null;

                  return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          mine
                            ? "bg-blue-600 text-white"
                            : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {message.body ? <div className="whitespace-pre-wrap">{message.body}</div> : null}
                        {document ? (
                          <a
                            className={`mt-2 flex items-center gap-2 rounded-xl border p-2 font-semibold ${
                              mine
                                ? "border-blue-400 bg-blue-500"
                                : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                            }`}
                            href={`/api/documents/${document.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Paperclip className="h-4 w-4" />
                            <span className="min-w-0">
                              <span className="block truncate">{document.document_title || document.file_name || "MCCS document"}</span>
                              <span className={`block truncate text-[10px] ${mine ? "text-blue-100" : "text-slate-500"}`}>
                                {document.vendor_name || "Unassigned Supplier / Contractor"}
                              </span>
                            </span>
                          </a>
                        ) : null}
                        <div className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                          {new Date(message.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-slate-400" />
                  <select
                    value={attachment}
                    onChange={(event) => setAttachment(event.target.value)}
                    className="max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">Attach an existing MCCS / Google Drive document (optional)</option>
                    {documents.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.vendor_name || "Unassigned"} — {document.document_title || document.file_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={2}
                    placeholder="Write a message..."
                    className="flex-1 resize-none rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    className="flex w-14 items-center justify-center rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
                    aria-label="Send message"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Enter to send • Shift+Enter for a new line • Chat text expires after 7 days
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400">Select a user to start messaging.</div>
          )}
        </section>
      </div>
    </div>
  );
}
