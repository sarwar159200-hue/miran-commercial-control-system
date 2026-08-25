"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Paperclip, Search, Send, UserRound } from "lucide-react";

type User = { id:string; full_name?:string|null; preferred_name?:string|null; avatar_url?:string|null; last_seen_at?:string|null };
type Doc = { id:string; document_title?:string|null; file_name?:string|null; document_type?:string|null };
type Msg = { id:string; sender_id:string; recipient_id:string; body:string; created_at:string; read_at?:string|null; attachment_document_id?:string|null };

export default function MessagesPage() {
  const [currentUserId,setCurrentUserId]=useState("");
  const [users,setUsers]=useState<User[]>([]);
  const [documents,setDocuments]=useState<Doc[]>([]);
  const supabase = useMemo(() => createClient(), []);
  const [selected, setSelected] = useState<User | null>(users[0] ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [attachment, setAttachment] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { (async()=>{
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) { window.location.href="/login"; return; }
    setCurrentUserId(user.id);
    const [{data:p},{data:d}] = await Promise.all([
      supabase.from("profiles").select("id,full_name,preferred_name,avatar_url,last_seen_at").neq("id",user.id).order("full_name"),
      supabase.from("commercial_documents").select("id,document_title,file_name,document_type").is("deleted_at",null).order("created_at",{ascending:false}).limit(100)
    ]);
    const list=(p as User[])??[]; setUsers(list); setSelected(list[0]??null); setDocuments((d as Doc[])??[]);
  })(); }, []);
  const name = (u:User) => u.preferred_name || u.full_name || "MCCS User";
  const online = (u:User) => u.last_seen_at ? Date.now() - new Date(u.last_seen_at).getTime() < 120000 : false;

  async function load() {
    if (!selected) return;
    const { data } = await supabase.from("chat_messages").select("*")
      .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${selected.id}),and(sender_id.eq.${selected.id},recipient_id.eq.${currentUserId})`)
      .order("created_at", { ascending:true }).limit(300);
    setMessages((data as Msg[]) ?? []);
    await supabase.from("chat_messages").update({ read_at:new Date().toISOString() }).eq("sender_id", selected.id).eq("recipient_id", currentUserId).is("read_at", null);
  }

  useEffect(() => { void load(); }, [selected?.id]);
  useEffect(() => {
    const ch = supabase.channel(`mccs-chat-${currentUserId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages" }, (p:any) => {
        const m=p.new as Msg;
        if (selected && ((m.sender_id===currentUserId && m.recipient_id===selected.id)||(m.sender_id===selected.id && m.recipient_id===currentUserId))) setMessages(v=>[...v,m]);
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [selected?.id]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior:"smooth" }), [messages.length]);

  async function send() {
    if (!selected || (!text.trim() && !attachment)) return;
    const body=text.trim(); setText("");
    const { error } = await supabase.from("chat_messages").insert({ sender_id:currentUserId, recipient_id:selected.id, body, attachment_document_id:attachment || null });
    if (error) { setText(body); alert(error.message); return; }
    setAttachment("");
  }

  const filtered=users.filter(u=>name(u).toLowerCase().includes(query.toLowerCase()));
  const docMap=new Map(documents.map(d=>[d.id,d]));

  return <div>
    <div className="mb-5"><div className="text-xs font-extrabold uppercase tracking-[.18em] text-blue-700">Collaboration</div><h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Messages</h1><p className="mt-1 text-sm text-slate-500">Private MCCS chat. Normal messages are automatically removed after 7 days; shared Google Drive documents remain available.</p></div>
    <div className="grid min-h-[680px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[310px_1fr]">
      <aside className="border-r border-slate-200 p-4 dark:border-slate-800">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"/></div>
        <div className="mt-4 space-y-1">{filtered.map(u=><button key={u.id} onClick={()=>setSelected(u)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${selected?.id===u.id?"bg-blue-50 dark:bg-blue-950/40":"hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100">{u.avatar_url?<img src={u.avatar_url} className="h-full w-full object-cover" alt=""/>:<UserRound className="m-2.5 h-6 w-6 text-slate-400"/>}<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${online(u)?"bg-emerald-500":"bg-slate-300"}`}/></div>
          <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900 dark:text-white">{name(u)}</div><div className={`text-xs ${online(u)?"text-emerald-600":"text-slate-400"}`}>{online(u)?"Online":"Offline"}</div></div>
        </button>)}</div>
      </aside>
      <section className="flex min-w-0 flex-col">
        {selected ? <>
          <header className="flex h-20 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800"><MessageCircle className="h-5 w-5 text-blue-600"/><div><div className="font-extrabold text-slate-950 dark:text-white">{name(selected)}</div><div className={`text-xs ${online(selected)?"text-emerald-600":"text-slate-400"}`}>{online(selected)?"Online now":"Offline"}</div></div></header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-5 dark:bg-slate-900/30">{messages.map(m=>{const mine=m.sender_id===currentUserId; const d=m.attachment_document_id?docMap.get(m.attachment_document_id):null; return <div key={m.id} className={`flex ${mine?"justify-end":"justify-start"}`}><div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine?"bg-blue-600 text-white":"bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}>{m.body?<div className="whitespace-pre-wrap">{m.body}</div>:null}{d?<a className={`mt-2 flex items-center gap-2 rounded-xl border p-2 font-semibold ${mine?"border-blue-400 bg-blue-500":"border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"}`} href={`/api/documents/${d.id}/file`} target="_blank"><Paperclip className="h-4 w-4"/>{d.document_title||d.file_name||"MCCS document"}</a>:null}<div className={`mt-1 text-[10px] ${mine?"text-blue-100":"text-slate-400"}`}>{new Date(m.created_at).toLocaleString()}</div></div></div>})}<div ref={bottom}/></div>
          <div className="border-t border-slate-200 p-4 dark:border-slate-800"><div className="mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4 text-slate-400"/><select value={attachment} onChange={e=>setAttachment(e.target.value)} className="max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="">Attach an existing MCCS / Google Drive document (optional)</option>{documents.map(d=><option key={d.id} value={d.id}>{d.document_title||d.file_name}</option>)}</select></div><div className="flex gap-2"><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}} rows={2} placeholder="Write a message..." className="flex-1 resize-none rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-900"/><button onClick={()=>void send()} className="flex w-14 items-center justify-center rounded-2xl bg-blue-600 text-white hover:bg-blue-700"><Send className="h-5 w-5"/></button></div><div className="mt-2 text-[11px] text-slate-400">Enter to send • Shift+Enter for a new line • Chat text expires after 7 days</div></div>
        </> : <div className="flex flex-1 items-center justify-center text-slate-400">Select a user to start messaging.</div>}
      </section>
    </div>
  </div>;
}
