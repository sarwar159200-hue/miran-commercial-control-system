"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type IncomingMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

type SenderProfile = {
  id: string;
  full_name?: string | null;
  preferred_name?: string | null;
  avatar_url?: string | null;
};

function profileName(profile?: SenderProfile | null) {
  return profile?.preferred_name?.trim() || profile?.full_name?.trim() || "MCCS User";
}

export function PresenceHeartbeat() {
  const supabase = useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = useState("");
  const [incoming, setIncoming] = useState<IncomingMessage | null>(null);
  const [sender, setSender] = useState<SenderProfile | null>(null);
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id || "";
      if (!active || !userId) return;
      setCurrentUserId(userId);

      const touch = async () => {
        const { error } = await supabase.rpc("touch_presence");
        if (error) console.warn("MCCS presence:", error.message);
      };

      void touch();
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!currentUserId) return;

    const touch = async () => {
      const { error } = await supabase.rpc("touch_presence");
      if (error) console.warn("MCCS presence:", error.message);
    };

    const timer = window.setInterval(() => void touch(), 45_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void touch();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentUserId, supabase]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`mccs-global-chat-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload: any) => {
          const message = payload?.new as IncomingMessage | undefined;
          if (!message?.id) return;

          setIncoming(message);
          setOpen(true);
          setUnread((value) => value + 1);

          void (async () => {
            const { data } = await supabase
              .from("profiles")
              .select("id,full_name,preferred_name,avatar_url")
              .eq("id", message.sender_id)
              .maybeSingle();
            setSender((data as SenderProfile | null) ?? null);
          })();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("MCCS global chat realtime channel error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase]);

  useEffect(() => {
    if (!open || !incoming || !currentUserId) return;
    void supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", incoming.id)
      .eq("recipient_id", currentUserId)
      .then(({ error }) => {
        if (error) console.warn("MCCS popup mark read:", error.message);
      });
    setUnread(0);
  }, [open, incoming?.id, currentUserId, supabase]);

  async function sendQuickReply() {
    const body = reply.trim();
    if (!body || !incoming || !currentUserId) return;

    const { error } = await supabase.from("chat_messages").insert({
      sender_id: currentUserId,
      recipient_id: incoming.sender_id,
      body,
      attachment_document_id: null,
    });

    if (error) {
      window.alert(error.message);
      return;
    }
    setReply("");
  }

  return (
    <>
      {incoming ? (
        <div className="fixed bottom-5 right-5 z-[80] w-[350px] max-w-[calc(100vw-2rem)]">
          {open ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold">
                    {sender?.avatar_url ? (
                      <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      profileName(sender).slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold">{profileName(sender)}</div>
                    <div className="text-[11px] text-slate-300">New MCCS message</div>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Close chat popup">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4">
                <div className="rounded-2xl bg-slate-100 px-3 py-2.5 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                  {incoming.body || "Shared a document with you."}
                </div>
                <div className="mt-1 text-right text-[10px] text-slate-400">
                  {new Date(incoming.created_at).toLocaleString()}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void sendQuickReply();
                      }
                    }}
                    placeholder="Quick reply..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button type="button" onClick={() => void sendQuickReply()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700" aria-label="Send quick reply">
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                <a href={`/messages?user=${incoming.sender_id}`} className="mt-3 block text-center text-xs font-bold text-blue-600 hover:underline">
                  Open full conversation
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl hover:bg-blue-700"
              aria-label="Open new message"
            >
              <MessageCircle className="h-6 w-6" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}


const MCCS_TAB_PATHS: Array<[string,string]> = [
  ["administration","/admin"],["payment_milestones","/payment-milestones"],["purchase_orders","/purchase-orders"],
  ["dashboard","/dashboard"],["vendors","/vendors"],["projects","/projects"],["invoices","/invoices"],
  ["payments","/payments"],["vdrl","/vdrl"],["documents","/documents"],["reports","/reports"],["messages","/messages"]
];
export function AccessGuard({children,allowedTabs,canAdmin}:{children:React.ReactNode;allowedTabs:string[];canAdmin:boolean}){
  const pathname=usePathname(),router=useRouter();
  useEffect(()=>{
    if(!allowedTabs.length)return;
    const match=MCCS_TAB_PATHS.find(([,path])=>pathname===path||pathname.startsWith(`${path}/`));
    if(!match)return;
    const [key]=match; const ok=(key==="administration"?canAdmin:true)&&allowedTabs.includes(key);
    if(!ok){const first=MCCS_TAB_PATHS.find(([k])=>allowedTabs.includes(k)&&(k!=="administration"||canAdmin));router.replace(first?.[1]||"/login");}
  },[pathname,allowedTabs.join("|"),canAdmin,router]);
  return <>{children}</>;
}
