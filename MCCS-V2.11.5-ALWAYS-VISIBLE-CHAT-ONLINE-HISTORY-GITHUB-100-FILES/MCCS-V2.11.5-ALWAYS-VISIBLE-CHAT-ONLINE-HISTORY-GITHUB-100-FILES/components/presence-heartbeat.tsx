"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MessageCircle, Send, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ChatMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

type ChatUser = {
  id: string;
  full_name?: string | null;
  preferred_name?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
};

function profileName(profile?: ChatUser | null) {
  return profile?.preferred_name?.trim() || profile?.full_name?.trim() || "MCCS User";
}

function isOnline(user?: ChatUser | null) {
  if (!user?.last_seen_at) return false;
  const seen = new Date(user.last_seen_at).getTime();
  return Number.isFinite(seen) && Date.now() - seen < 120_000;
}

function sameConversation(message: ChatMessage, selfId: string, partnerId: string) {
  return (
    (message.sender_id === selfId && message.recipient_id === partnerId) ||
    (message.sender_id === partnerId && message.recipient_id === selfId)
  );
}

export function PresenceHeartbeat() {
  const supabase = useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = useState("");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedUser = users.find((user) => user.id === selectedId) ?? null;
  const onlineUsers = users.filter(isOnline);

  const refreshUsers = useCallback(async (selfId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,preferred_name,avatar_url,last_seen_at")
      .neq("id", selfId)
      .order("full_name", { ascending: true });

    if (error) {
      console.warn("MCCS popup users:", error.message);
      return;
    }

    const list = Array.isArray(data) ? (data as ChatUser[]) : [];
    setUsers(list);
    setSelectedId((existing) => existing || list[0]?.id || "");
  }, [supabase]);

  const loadConversation = useCallback(async (selfId: string, partnerId: string) => {
    if (!selfId || !partnerId) return;
    setLoading(true);
    try {
      const [sentResult, receivedResult] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("id,sender_id,recipient_id,body,created_at,read_at")
          .eq("sender_id", selfId)
          .eq("recipient_id", partnerId)
          .order("created_at", { ascending: true })
          .limit(150),
        supabase
          .from("chat_messages")
          .select("id,sender_id,recipient_id,body,created_at,read_at")
          .eq("sender_id", partnerId)
          .eq("recipient_id", selfId)
          .order("created_at", { ascending: true })
          .limit(150),
      ]);

      if (sentResult.error) throw sentResult.error;
      if (receivedResult.error) throw receivedResult.error;

      const merged = [
        ...(Array.isArray(sentResult.data) ? sentResult.data : []),
        ...(Array.isArray(receivedResult.data) ? receivedResult.data : []),
      ] as ChatMessage[];

      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(merged.slice(-150));

      await supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", partnerId)
        .eq("recipient_id", selfId)
        .is("read_at", null);
    } catch (error: any) {
      console.warn("MCCS popup conversation:", error?.message || error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id || "";
      if (!active || !userId) return;
      setCurrentUserId(userId);

      const { error } = await supabase.rpc("touch_presence");
      if (error) console.warn("MCCS presence:", error.message);
      await refreshUsers(userId);
    })();

    return () => {
      active = false;
    };
  }, [refreshUsers, supabase]);

  useEffect(() => {
    if (!currentUserId) return;

    const touch = async () => {
      const { error } = await supabase.rpc("touch_presence");
      if (error) console.warn("MCCS presence:", error.message);
    };

    const presenceTimer = window.setInterval(() => void touch(), 45_000);
    const userTimer = window.setInterval(() => void refreshUsers(currentUserId), 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void touch();
        void refreshUsers(currentUserId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(presenceTimer);
      window.clearInterval(userTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentUserId, refreshUsers, supabase]);

  useEffect(() => {
    if (!currentUserId || !selectedId) return;
    void loadConversation(currentUserId, selectedId);
  }, [currentUserId, selectedId, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, open]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`mccs-global-chat-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: any) => {
          const message = payload?.new as ChatMessage | undefined;
          if (!message?.id) return;

          const relevantToMe = message.sender_id === currentUserId || message.recipient_id === currentUserId;
          if (!relevantToMe) return;

          if (message.recipient_id === currentUserId) {
            setSelectedId(message.sender_id);
            setOpen(true);
            setUnread((value) => value + 1);
          }

          const partnerId = message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
          if (partnerId === selectedId) {
            setMessages((existing) => {
              if (existing.some((item) => item.id === message.id)) return existing;
              return [...existing, message].slice(-150);
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("MCCS global chat realtime channel error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedId, supabase]);

  useEffect(() => {
    if (!open || !currentUserId || !selectedId) return;
    setUnread(0);
    void supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", selectedId)
      .eq("recipient_id", currentUserId)
      .is("read_at", null);
  }, [open, currentUserId, selectedId, supabase]);

  async function sendQuickReply() {
    const body = reply.trim();
    if (!body || !selectedId || !currentUserId) return;

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      recipient_id: selectedId,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((existing) => [...existing, optimistic].slice(-150));
    setReply("");

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        sender_id: currentUserId,
        recipient_id: selectedId,
        body,
        attachment_document_id: null,
      })
      .select("id,sender_id,recipient_id,body,created_at,read_at")
      .single();

    if (error) {
      setMessages((existing) => existing.filter((item) => item.id !== optimistic.id));
      window.alert(error.message);
      return;
    }

    setMessages((existing) => existing.map((item) => item.id === optimistic.id ? (data as ChatMessage) : item));
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[390px] max-w-[calc(100vw-1.25rem)]">
      {open ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
          <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white">
            <div>
              <div className="text-sm font-extrabold">MCCS Chat</div>
              <div className="mt-0.5 text-[11px] text-slate-300">
                {onlineUsers.length} user{onlineUsers.length === 1 ? "" : "s"} online
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Minimize chat popup">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              <Users className="h-3.5 w-3.5" /> Online users
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {onlineUsers.length ? onlineUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedId(user.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${selectedId === user.id ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                >
                  <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[9px] font-black text-slate-700 dark:bg-slate-700 dark:text-white">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : profileName(user).slice(0, 2).toUpperCase()}
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white bg-emerald-500" />
                  </span>
                  <span className="max-w-[110px] truncate">{profileName(user)}</span>
                </button>
              )) : (
                <span className="text-xs text-slate-400">No other users online right now.</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold text-white">
              {selectedUser?.avatar_url ? (
                <img src={selectedUser.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                profileName(selectedUser).slice(0, 2).toUpperCase()
              )}
              {isOnline(selectedUser) ? <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{selectedUser ? profileName(selectedUser) : "Select a user"}</div>
              <div className={`text-[11px] font-semibold ${isOnline(selectedUser) ? "text-emerald-600" : "text-slate-400"}`}>
                {selectedUser ? (isOnline(selectedUser) ? "Online" : "Offline") : "Choose an online user above"}
              </div>
            </div>
            {selectedId ? <a href={`/messages?user=${selectedId}`} className="text-[11px] font-bold text-blue-600 hover:underline">Full chat</a> : null}
          </div>

          <div className="h-[285px] overflow-y-auto bg-slate-50 px-3 py-3 dark:bg-slate-900/60">
            {loading ? (
              <div className="py-10 text-center text-xs text-slate-400">Loading conversation…</div>
            ) : messages.length ? (
              <div className="space-y-2">
                {messages.filter((message) => selectedId && sameConversation(message, currentUserId, selectedId)).map((message) => {
                  const mine = message.sender_id === currentUserId;
                  return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"}`}>
                        <div className="whitespace-pre-wrap break-words">{message.body || "Shared a document."}</div>
                        <div className={`mt-1 text-[9px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                          {new Date(message.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-slate-400">
                {selectedId ? "No messages yet. Start the conversation." : "Select a user to start chatting."}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <div className="flex gap-2">
              <input
                value={reply}
                disabled={!selectedId}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendQuickReply();
                  }
                }}
                placeholder={selectedId ? "Write a message…" : "Select a user first"}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
              />
              <button type="button" disabled={!selectedId || !reply.trim()} onClick={() => void sendQuickReply()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send quick reply">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 text-[9px] text-slate-400">Conversation history is scrollable • Chat text expires after 7 days</div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl transition hover:scale-105 hover:bg-blue-700"
          aria-label="Open MCCS chat"
          title={`${onlineUsers.length} users online`}
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -left-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}
