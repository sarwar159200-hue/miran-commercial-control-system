"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Check, CheckCheck, ChevronDown, FileText, MessageCircle, Mic, MoreVertical,
  Paperclip, Phone, Search, Send, Square, UserPlus, Users, X
} from "lucide-react";
import { uploadChatVoice } from "../_actions/commercial";

type ChatUser={id:string;full_name?:string|null;preferred_name?:string|null;avatar_url?:string|null;last_seen_at?:string|null;is_super_admin?:boolean|null};
type ChatDocument={id:string;document_title?:string|null;file_name?:string|null;document_type?:string|null;vendor_id?:string|null;vendor_name?:string|null};
type ChatMessage={id:string;sender_id:string;recipient_id?:string|null;group_id?:string|null;body:string;created_at:string;read_at?:string|null;attachment_document_id?:string|null;message_type?:string|null;voice_duration_seconds?:number|null;voice_waveform?:number[]|null};
type ChatGroup={id:string;name:string;created_by:string;created_at:string;member_count?:number;last_read_at?:string|null};
type GroupMember={group_id:string;user_id:string;role?:string|null;joined_at?:string|null;last_read_at?:string|null};

const PAGE_SIZE=50;
function name(u?:ChatUser|null){return u?.preferred_name?.trim()||u?.full_name?.trim()||"MCCS User"}
function initials(u?:ChatUser|null){const p=name(u).split(/\s+/);return `${p[0]?.[0]||"U"}${p[1]?.[0]||p[0]?.[1]||""}`.toUpperCase()}
function groupInitials(v?:string|null){const p=String(v||"Group").trim().split(/\s+/);return `${p[0]?.[0]||"G"}${p[1]?.[0]||p[0]?.[1]||""}`.toUpperCase()}
function fmtTime(v?:string|null){if(!v)return"";return new Date(v).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
function fmtDate(v?:string|null){if(!v)return"";return new Date(v).toLocaleString([],{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function durationLabel(s?:number|null){const n=Math.max(0,Math.round(Number(s||0)));return `${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`}
function bars(v?:number[]|null){return Array.isArray(v)&&v.length?v.slice(0,46):Array.from({length:34},(_,i)=>.18+((i*13)%8)/12)}

export default function MessagesPage(){
  const supabase=useMemo(()=>createClient(),[]);
  const [me,setMe]=useState("");
  const [self,setSelf]=useState<ChatUser|null>(null);
  const [users,setUsers]=useState<ChatUser[]>([]);
  const [groups,setGroups]=useState<ChatGroup[]>([]);
  const [groupMembers,setGroupMembers]=useState<GroupMember[]>([]);
  const [online,setOnline]=useState<Set<string>>(new Set());
  const [selectedId,setSelectedId]=useState("");
  const [selectedGroupId,setSelectedGroupId]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [hasOlder,setHasOlder]=useState(false);
  const [loadingOlder,setLoadingOlder]=useState(false);
  const [documents,setDocuments]=useState<ChatDocument[]>([]);
  const [attachment,setAttachment]=useState("");
  const [text,setText]=useState("");
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [newBelow,setNewBelow]=useState(false);
  const [showAdminHeader,setShowAdminHeader]=useState(false);
  const [unreadByUser,setUnreadByUser]=useState<Record<string,number>>({});
  const [showGroupModal,setShowGroupModal]=useState(false);
  const [groupName,setGroupName]=useState("");
  const [groupSelection,setGroupSelection]=useState<string[]>([]);
  const [creatingGroup,setCreatingGroup]=useState(false);
  const scrollRef=useRef<HTMLDivElement>(null);
  const bottomRef=useRef<HTMLDivElement>(null);
  const oldestRef=useRef("");

  const isGroup=Boolean(selectedGroupId);
  const selected=users.find(u=>u.id===selectedId)||null;
  const selectedGroup=groups.find(g=>g.id===selectedGroupId)||null;
  const activeTitle=isGroup?(selectedGroup?.name||"Group"):name(selected);
  const activeOnline=!isGroup&&selected?online.has(selected.id):false;
  const docMap=useMemo(()=>new Map(documents.map(d=>[d.id,d])),[documents]);
  const userMap=useMemo(()=>new Map([...(self?[self]:[]),...users].map(u=>[u.id,u])),[self,users]);

  // Voice message recording.
  const [recording,setRecording]=useState(false);
  const [recSec,setRecSec]=useState(0);
  const [wave,setWave]=useState<number[]>([]);
  const waveRef=useRef<number[]>([]);
  const [preview,setPreview]=useState<{blob:Blob;url:string;duration:number;waveform:number[]}|null>(null);
  const recRef=useRef<MediaRecorder|null>(null);
  const chunks=useRef<Blob[]>([]);
  const streamRef=useRef<MediaStream|null>(null);
  const recStarted=useRef(0);
  const timerRef=useRef<number|null>(null);

  const pairFilter=useCallback((partner:string)=>`and(sender_id.eq.${me},recipient_id.eq.${partner}),and(sender_id.eq.${partner},recipient_id.eq.${me})`,[me]);

  const refreshUnread=useCallback(async()=>{
    if(!me)return;
    const {data}=await supabase.from("chat_messages").select("sender_id").eq("recipient_id",me).is("read_at",null).is("group_id",null);
    const next:Record<string,number>={};
    for(const row of (data||[]) as any[]){const id=String(row.sender_id||"");if(id)next[id]=(next[id]||0)+1}
    setUnreadByUser(next);
  },[me,supabase]);

  const loadGroups=useCallback(async(uid:string)=>{
    const {data:members,error:memberError}=await supabase.from("chat_group_members").select("group_id,last_read_at").eq("user_id",uid);
    if(memberError){setGroups([]);return}
    const ids=(members||[]).map((m:any)=>String(m.group_id)).filter(Boolean);
    if(!ids.length){setGroups([]);return}
    const [{data:groupRows},{data:allMembers}]=await Promise.all([
      supabase.from("chat_groups").select("id,name,created_by,created_at").in("id",ids).order("created_at",{ascending:false}),
      supabase.from("chat_group_members").select("group_id,user_id").in("group_id",ids)
    ]);
    const counts=new Map<string,number>();for(const m of allMembers||[])counts.set(String((m as any).group_id),(counts.get(String((m as any).group_id))||0)+1);
    const readMap=new Map((members||[]).map((m:any)=>[String(m.group_id),m.last_read_at||null]));
    setGroups(((groupRows||[]) as any[]).map(g=>({...g,member_count:counts.get(String(g.id))||0,last_read_at:readMap.get(String(g.id))||null})));
  },[supabase]);

  const markDirectRead=useCallback(async(partner:string)=>{
    if(!me||!partner)return;
    const now=new Date().toISOString();
    await supabase.from("chat_messages").update({read_at:now}).eq("sender_id",partner).eq("recipient_id",me).is("read_at",null).is("group_id",null);
    setUnreadByUser(x=>({...x,[partner]:0}));
    window.dispatchEvent(new Event("mccs:refresh-unread"));
  },[me,supabase]);

  const markGroupRead=useCallback(async(groupId:string)=>{
    if(!me||!groupId)return;
    await supabase.from("chat_group_members").update({last_read_at:new Date().toISOString()}).eq("group_id",groupId).eq("user_id",me);
  },[me,supabase]);

  const loadLatest=useCallback(async()=>{
    if(!me||(!selectedId&&!selectedGroupId))return;
    setError("");
    let q=supabase.from("chat_messages").select("id,sender_id,recipient_id,group_id,body,created_at,read_at,attachment_document_id,message_type,voice_duration_seconds,voice_waveform");
    if(selectedGroupId)q=q.eq("group_id",selectedGroupId); else q=q.is("group_id",null).or(pairFilter(selectedId));
    const {data,error:e}=await q.order("created_at",{ascending:false}).limit(PAGE_SIZE+1);
    if(e){setError(e.message);return}
    const rows=(data||[]) as ChatMessage[];
    setHasOlder(rows.length>PAGE_SIZE);
    const page=rows.slice(0,PAGE_SIZE).reverse();
    setMessages(page);
    oldestRef.current=page[0]?.created_at||"";
    if(selectedGroupId)await markGroupRead(selectedGroupId); else await markDirectRead(selectedId);
    requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"auto"}));
  },[me,selectedId,selectedGroupId,pairFilter,supabase,markDirectRead,markGroupRead]);

  async function loadOlder(){
    if((!selectedId&&!selectedGroupId)||!hasOlder||loadingOlder||!oldestRef.current)return;
    const box=scrollRef.current;if(!box)return;
    setLoadingOlder(true);const oldHeight=box.scrollHeight;
    let q=supabase.from("chat_messages").select("id,sender_id,recipient_id,group_id,body,created_at,read_at,attachment_document_id,message_type,voice_duration_seconds,voice_waveform").lt("created_at",oldestRef.current);
    if(selectedGroupId)q=q.eq("group_id",selectedGroupId); else q=q.is("group_id",null).or(pairFilter(selectedId));
    const {data,error:e}=await q.order("created_at",{ascending:false}).limit(PAGE_SIZE+1);
    if(!e){const rows=(data||[]) as ChatMessage[];setHasOlder(rows.length>PAGE_SIZE);const page=rows.slice(0,PAGE_SIZE).reverse();setMessages(m=>[...page,...m]);oldestRef.current=page[0]?.created_at||oldestRef.current;requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight-oldHeight+box.scrollTop})}
    setLoadingOlder(false);
  }

  useEffect(()=>{let alive=true;void(async()=>{
    const {data}=await supabase.auth.getUser();const uid=data.user?.id||"";if(!uid||!alive)return;setMe(uid);
    const [{data:profiles},{data:myProfile},{data:docs},{data:vendors},{data:roleLinks}]=await Promise.all([
      supabase.from("profiles").select("id,full_name,preferred_name,avatar_url,last_seen_at,is_super_admin").neq("id",uid).order("full_name"),
      supabase.from("profiles").select("id,full_name,preferred_name,avatar_url,last_seen_at,is_super_admin").eq("id",uid).maybeSingle(),
      supabase.from("documents").select("id,document_title,file_name,document_type,vendor_id").eq("is_deleted",false).neq("document_category","chat_voice").order("uploaded_at",{ascending:false}).limit(250),
      supabase.from("vendors").select("id,vendor_name"),
      supabase.from("user_roles").select("role_id").eq("user_id",uid)
    ]);
    setSelf((myProfile||{id:uid,full_name:data.user?.email||"You"}) as ChatUser);
    let privileged=Boolean((myProfile as any)?.is_super_admin);
    const roleIds=(roleLinks||[]).map((r:any)=>r.role_id).filter(Boolean);
    if(roleIds.length){const {data:roles}=await supabase.from("roles").select("role_code").in("id",roleIds);privileged=privileged||(roles||[]).some((r:any)=>["admin","super_admin"].includes(String(r.role_code||"").toLowerCase()))}
    setShowAdminHeader(privileged);
    const vm=new Map((vendors||[]).map((v:any)=>[String(v.id),String(v.vendor_name||"")]));
    setDocuments(((docs||[]) as any[]).map(d=>({...d,vendor_name:vm.get(String(d.vendor_id||""))||"Unassigned Supplier"})));
    const list=(profiles||[]) as ChatUser[];setUsers(list);
    await Promise.all([loadGroups(uid),refreshUnread()]);
    const params=new URLSearchParams(location.search);const qs=params.get("user");const qg=params.get("group");
    if(qg)setSelectedGroupId(qg);else setSelectedId(qs||list[0]?.id||"");
  })();return()=>{alive=false}},[supabase,loadGroups,refreshUnread]);

  useEffect(()=>{if(!me)return;const sync=(event:Event)=>{const ids=(event as CustomEvent<{online:string[]}>).detail?.online||[];setOnline(new Set(ids))};window.addEventListener("mccs:presence",sync as EventListener);window.dispatchEvent(new Event("mccs:presence-request"));return()=>window.removeEventListener("mccs:presence",sync as EventListener)},[me]);
  useEffect(()=>{if(me&&(selectedId||selectedGroupId))void loadLatest()},[me,selectedId,selectedGroupId,loadLatest]);
  useEffect(()=>{if(!selectedGroupId){setGroupMembers([]);return}void(async()=>{const {data}=await supabase.from("chat_group_members").select("group_id,user_id,role,joined_at,last_read_at").eq("group_id",selectedGroupId).order("joined_at");setGroupMembers((data||[]) as GroupMember[])})()},[selectedGroupId,supabase]);

  // Realtime messages + sender-side seen receipt updates.
  useEffect(()=>{if(!me)return;const ch=supabase.channel(`mccs-messages-page-${me}`)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},(p:any)=>{const m=p.new as ChatMessage;const direct=!m.group_id&&selectedId&&((m.sender_id===me&&m.recipient_id===selectedId)||(m.sender_id===selectedId&&m.recipient_id===me));const group=!!m.group_id&&m.group_id===selectedGroupId;if(!direct&&!group){if(m.recipient_id===me)void refreshUnread();return}setMessages(x=>x.some(y=>y.id===m.id)?x:[...x,m]);if(m.sender_id!==me){if(group)void markGroupRead(selectedGroupId);else void markDirectRead(selectedId)}const box=scrollRef.current;const atBottom=!box||box.scrollHeight-box.scrollTop-box.clientHeight<120;if(atBottom)requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}));else setNewBelow(true)})
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"chat_messages"},(p:any)=>{const m=p.new as ChatMessage;setMessages(x=>x.map(v=>v.id===m.id?{...v,...m}:v))})
    .subscribe();return()=>{void supabase.removeChannel(ch)}},[me,selectedId,selectedGroupId,supabase,refreshUnread,markDirectRead,markGroupRead]);

  useEffect(()=>{if(!me)return;const ch=supabase.channel(`mccs-group-memberships-${me}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"chat_group_members"},()=>void loadGroups(me)).subscribe();return()=>{void supabase.removeChannel(ch)}},[me,loadGroups,supabase]);

  function chooseUser(id:string){setSelectedGroupId("");setSelectedId(id);setNewBelow(false)}
  function chooseGroup(id:string){setSelectedId("");setSelectedGroupId(id);setNewBelow(false)}
  function initiateCall(){if(!selectedId||isGroup)return;window.dispatchEvent(new CustomEvent("mccs:start-voice-call",{detail:{userId:selectedId}}))}

  async function sendMessage(){
    const body=text.trim();if(!me||(!selectedId&&!selectedGroupId)||(!body&&!attachment))return;
    const payload:any={sender_id:me,body,attachment_document_id:attachment||null,message_type:"text"};
    if(selectedGroupId){payload.group_id=selectedGroupId;payload.recipient_id=null}else{payload.group_id=null;payload.recipient_id=selectedId}
    const {data,error:e}=await supabase.from("chat_messages").insert(payload).select("id,sender_id,recipient_id,group_id,body,created_at,read_at,attachment_document_id,message_type,voice_duration_seconds,voice_waveform").single();
    if(e){setError(e.message);return}setText("");setAttachment("");if(data)setMessages(x=>x.some(m=>m.id===data.id)?x:[...x,data as ChatMessage]);requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}));
  }

  async function startRecording(){if(recording)return;setError("");setPreview(null);setWave([]);waveRef.current=[];try{const s=await navigator.mediaDevices.getUserMedia({audio:true,video:false});streamRef.current=s;const mime=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";const r=new MediaRecorder(s,{mimeType:mime});recRef.current=r;chunks.current=[];recStarted.current=Date.now();r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{const dur=Math.max(1,Math.round((Date.now()-recStarted.current)/1000));const blob=new Blob(chunks.current,{type:r.mimeType});if(blob.size)setPreview({blob,url:URL.createObjectURL(blob),duration:dur,waveform:waveRef.current.length?waveRef.current:bars()});setRecording(false);streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;if(timerRef.current)window.clearInterval(timerRef.current)};r.start(250);setRecording(true);timerRef.current=window.setInterval(()=>{const sec=Math.floor((Date.now()-recStarted.current)/1000);setRecSec(sec);const sample=.16+((Date.now()/110)%8)/11;waveRef.current=[...waveRef.current.slice(-45),Math.min(1,sample)];setWave(waveRef.current)},120)}catch{setError("Microphone access is required to record a voice message.")}}
  function stopRecording(){if(recRef.current?.state==="recording")recRef.current.stop()}
  function cancelRecording(){if(recRef.current?.state==="recording"){recRef.current.onstop=null;recRef.current.stop()}streamRef.current?.getTracks().forEach(t=>t.stop());setRecording(false);setPreview(null);setRecSec(0);setWave([])}
  async function sendVoice(){if(!preview||(!selectedId&&!selectedGroupId))return;const fd=new FormData();if(selectedGroupId)fd.append("group_id",selectedGroupId);else fd.append("recipient_id",selectedId);fd.append("duration_seconds",String(preview.duration));fd.append("waveform",JSON.stringify(preview.waveform));fd.append("voice",new File([preview.blob],`voice-${Date.now()}.webm`,{type:preview.blob.type||"audio/webm"}));try{const m=await uploadChatVoice(fd) as ChatMessage;setMessages(x=>[...x,m]);URL.revokeObjectURL(preview.url);setPreview(null)}catch(e:any){setError(e?.message||"Voice message could not be sent.")}}

  async function createGroup(){
    const title=groupName.trim();const members=Array.from(new Set(groupSelection.filter(Boolean)));
    if(!me||!title||members.length<1){setError("Enter a group name and select at least one other user.");return}
    setCreatingGroup(true);setError("");
    const {data:g,error:e}=await supabase.from("chat_groups").insert({name:title,created_by:me}).select("id,name,created_by,created_at").single();
    if(e||!g){setCreatingGroup(false);setError(e?.message||"Group could not be created.");return}
    const rows=[{group_id:g.id,user_id:me,role:"owner"},...members.map(user_id=>({group_id:g.id,user_id,role:"member"}))];
    const {error:meErr}=await supabase.from("chat_group_members").insert(rows);
    if(meErr){setCreatingGroup(false);setError(meErr.message);return}
    setShowGroupModal(false);setGroupName("");setGroupSelection([]);await loadGroups(me);chooseGroup(String(g.id));setCreatingGroup(false);
  }

  const q=query.trim().toLowerCase();
  const filtered=users.filter(u=>name(u).toLowerCase().includes(q)).sort((a,b)=>Number(online.has(b.id))-Number(online.has(a.id))||name(a).localeCompare(name(b)));
  const filteredGroups=groups.filter(g=>g.name.toLowerCase().includes(q));
  const groupMemberUsers=groupMembers.map(m=>({member:m,user:userMap.get(m.user_id)||null}));

  return <div className="mx-auto max-w-[1680px]">
    {showAdminHeader?<div className="mb-4"><div className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Collaboration</div><h1 className="text-3xl font-black text-slate-950 dark:text-white">Messages</h1><p className="text-sm text-slate-500">Private MCCS chat, Google Drive attachments, voice messages and secure WebRTC voice calls.</p></div>:null}
    {error?<div className="mb-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><span>{error}</span><button onClick={()=>setError("")}><X className="h-4 w-4"/></button></div>:null}

    <div className={`grid ${showAdminHeader?"h-[calc(100vh-185px)]":"h-[calc(100vh-112px)]"} min-h-[620px] grid-cols-[330px_minmax(0,1fr)_320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950`}>
      <aside className="flex min-h-0 flex-col border-r border-slate-200 dark:border-slate-800">
        <div className="shrink-0 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users or groups..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900"/></div><button onClick={()=>setShowGroupModal(true)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700" title="Create group"><UserPlus className="h-5 w-5"/></button></div>
          <div className="mt-3 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Conversations</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{online.size} online</span></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pr-1 [scrollbar-gutter:stable]">
          {filteredGroups.length?<><div className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">Groups</div>{filteredGroups.map(g=><button key={g.id} onClick={()=>chooseGroup(g.id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selectedGroupId===g.id?"bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-950/40":"hover:bg-slate-50 dark:hover:bg-slate-900"}`}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300">{groupInitials(g.name)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{g.name}</div><div className="text-xs text-slate-400">{g.member_count||0} members</div></div><Users className="h-4 w-4 text-slate-300"/></button>)}</>:null}
          <div className="px-2 pb-1 pt-3 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">People</div>
          {filtered.map(u=>{const unread=unreadByUser[u.id]||0;return <button key={u.id} onClick={()=>chooseUser(u.id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selectedId===u.id?"bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-950/40":"hover:bg-slate-50 dark:hover:bg-slate-900"}`}><div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100 text-center text-sm font-black leading-[44px] dark:bg-slate-800">{u.avatar_url?<img src={u.avatar_url} className="h-full w-full object-cover" alt=""/>:initials(u)}<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 ${online.has(u.id)?"bg-emerald-500":"bg-slate-300"}`}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{name(u)}</div><div className={`truncate text-xs ${online.has(u.id)?"font-bold text-emerald-600":"text-slate-400"}`}>{online.has(u.id)?"Online":u.last_seen_at?`Last seen ${fmtDate(u.last_seen_at)}`:"Offline"}</div></div>{unread>0?<span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">{unread>99?"99+":unread}</span>:null}</button>})}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3"><div className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ${isGroup?"bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300":"bg-slate-100 dark:bg-slate-800"}`}>{isGroup?groupInitials(selectedGroup?.name):selected?.avatar_url?<img src={selected.avatar_url} className="h-full w-full object-cover" alt=""/>:<span className="font-black">{initials(selected)}</span>}{!isGroup&&selected?<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 ${online.has(selected.id)?"bg-emerald-500":"bg-slate-300"}`}/>:null}</div><div className="min-w-0"><div className="truncate font-black text-slate-950 dark:text-white">{activeTitle}</div><div className={`truncate text-xs ${isGroup?"text-slate-400":activeOnline?"font-bold text-emerald-600":"text-slate-400"}`}>{isGroup?`${selectedGroup?.member_count||0} members`:activeOnline?"● Online":selected?.last_seen_at?`Last seen ${fmtDate(selected.last_seen_at)}`:"Offline"}</div></div></div>
          <div className="flex items-center gap-2">{!isGroup?<button onClick={initiateCall} disabled={!selectedId} className="rounded-xl border border-slate-200 p-2.5 text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:border-slate-700" title="Voice Call"><Phone className="h-5 w-5"/></button>:null}<button className="rounded-xl border border-slate-200 p-2.5 text-slate-500 dark:border-slate-700" title="More"><MoreVertical className="h-5 w-5"/></button></div>
        </div>

        <div ref={scrollRef} onScroll={e=>{const el=e.currentTarget;if(el.scrollTop<80)void loadOlder();if(el.scrollHeight-el.scrollTop-el.clientHeight<90)setNewBelow(false)}} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,.08)_1px,transparent_0)] bg-[length:18px_18px] p-5 dark:bg-slate-950 [scrollbar-gutter:stable]">
          {loadingOlder?<div className="mb-3 text-center text-xs font-bold text-slate-400">Loading earlier messages…</div>:null}
          {!hasOlder&&messages.length?<div className="mb-4 text-center text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Beginning of conversation</div>:null}
          {messages.map(m=>{const mine=m.sender_id===me;const doc=m.attachment_document_id?docMap.get(m.attachment_document_id):null;const voice=m.message_type==="voice";const sender=userMap.get(m.sender_id);return <div key={m.id} className={`mb-3 flex ${mine?"justify-end":"justify-start"}`}><div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine?"bg-blue-600 text-white":"border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"}`}>{isGroup&&!mine?<div className={`mb-1 text-[10px] font-black uppercase tracking-wide ${mine?"text-blue-100":"text-blue-600"}`}>{name(sender)}</div>:null}{m.body?<div className="whitespace-pre-wrap break-words">{m.body}</div>:null}{doc?<a href={`/api/documents/${doc.id}/file`} target="_blank" className={`mt-2 flex items-center gap-2 rounded-xl border p-2.5 ${mine?"border-white/20 bg-white/10":"border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"}`}><FileText className="h-5 w-5"/><span className="min-w-0"><span className="block truncate font-bold">{doc.document_title||doc.file_name}</span><span className={`block text-[11px] ${mine?"text-blue-100":"text-slate-500"}`}>{doc.vendor_name||"Unassigned Supplier"}</span></span></a>:null}{voice&&m.attachment_document_id?<div className="mt-2 flex items-center gap-2"><audio controls preload="metadata" src={`/api/documents/${m.attachment_document_id}/file`} className="h-9 max-w-[290px]"/><span className="text-xs">{durationLabel(m.voice_duration_seconds)}</span></div>:null}<div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${mine?"text-blue-100":"text-slate-400"}`}><span>{fmtTime(m.created_at)}</span>{mine&&!isGroup?(m.read_at?<span className="inline-flex items-center gap-1 font-bold text-cyan-100" title={`Seen ${fmtDate(m.read_at)}`}><CheckCheck className="h-3.5 w-3.5"/>Seen</span>:<span className="inline-flex items-center gap-1" title="Delivered to MCCS"><Check className="h-3.5 w-3.5"/>Delivered</span>):mine&&isGroup?<span>Sent</span>:null}</div></div></div>})}
          <div ref={bottomRef}/>{newBelow?<button onClick={()=>bottomRef.current?.scrollIntoView({behavior:"smooth"})} className="sticky bottom-2 mx-auto flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-lg"><ChevronDown className="h-4 w-4"/>New Messages</button>:null}
        </div>

        <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800"><div className="mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4 text-slate-400"/><select value={attachment} onChange={e=>setAttachment(e.target.value)} className="max-w-[560px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="">Attach an existing MCCS / Google Drive document</option>{documents.map(d=><option key={d.id} value={d.id}>{d.vendor_name} — {d.document_title||d.file_name}</option>)}</select></div>
          {recording?<div className="mb-2 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3"><Mic className="h-5 w-5 text-rose-600"/><span className="font-bold text-rose-700">{durationLabel(recSec)}</span><div className="flex flex-1 items-center gap-[2px]">{bars(wave).map((v,i)=><span key={i} className="w-[2px] rounded bg-rose-400" style={{height:`${8+v*22}px`}}/>)}</div><button onClick={cancelRecording} className="rounded-lg px-3 py-2 text-sm font-bold">Cancel</button><button onClick={stopRecording} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white"><Square className="h-4 w-4"/></button></div>:null}
          {preview?<div className="mb-2 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><audio controls src={preview.url} className="h-9 flex-1"/><button onClick={()=>{URL.revokeObjectURL(preview.url);setPreview(null)}} className="rounded-lg px-3 py-2 text-sm font-bold">Delete</button><button onClick={()=>void sendVoice()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">Send</button></div>:null}
          <div className="flex items-end gap-2"><button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700"><Paperclip className="h-4 w-4"/></button><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendMessage()}}} placeholder="Type a message..." rows={1} className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"/><button onClick={()=>void startRecording()} disabled={!selectedId&&!selectedGroupId} className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40" title="Record voice message"><Mic className="h-5 w-5"/></button><button onClick={()=>void sendMessage()} disabled={!selectedId&&!selectedGroupId} className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40"><Send className="h-5 w-5"/></button></div></div>
      </section>

      <aside className="min-h-0 overflow-y-auto border-l border-slate-200 p-4 dark:border-slate-800">
        {isGroup?<><div className="pt-4 text-center"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-2xl font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300">{groupInitials(selectedGroup?.name)}</div><div className="mt-3 text-lg font-black">{selectedGroup?.name}</div><div className="mt-1 text-xs text-slate-400">{selectedGroup?.member_count||0} members</div></div><div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800"><div className="mb-2 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">Members</div><div className="space-y-2">{groupMemberUsers.map(({member,user})=><div key={member.user_id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900"><div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100 text-center text-[11px] font-black leading-9 dark:bg-slate-800">{user?.avatar_url?<img src={user.avatar_url} className="h-full w-full object-cover" alt=""/>:initials(user)}<span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${online.has(member.user_id)?"bg-emerald-500":"bg-slate-300"}`}/></div><div className="min-w-0"><div className="truncate text-xs font-bold">{member.user_id===me?`${name(user)} (You)`:name(user)}</div><div className="text-[10px] text-slate-400">{member.role||"member"}</div></div></div>)}</div></div></>:<div className="pt-6 text-center"><div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-slate-100 text-2xl font-black leading-[96px] dark:bg-slate-800">{selected?.avatar_url?<img src={selected.avatar_url} className="h-full w-full object-cover" alt=""/>:initials(selected)}</div><div className="mt-3 text-lg font-black">{name(selected)}</div><div className={`mt-1 text-xs font-bold ${selected&&online.has(selected.id)?"text-emerald-600":"text-slate-400"}`}>{selected&&online.has(selected.id)?"● Online":selected?.last_seen_at?`Last seen ${fmtDate(selected.last_seen_at)}`:"Offline"}</div><button onClick={initiateCall} className="mx-auto mt-6 flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-3 text-sm font-bold text-blue-600"><Phone className="h-4 w-4"/>Voice Call</button><div className="mt-6 border-t border-slate-200 pt-4 text-left dark:border-slate-800"><div className="text-[10px] font-black uppercase tracking-[.15em] text-slate-400">Delivery status</div><p className="mt-2 text-xs leading-5 text-slate-500">Single check = delivered to MCCS. Double check with “Seen” = recipient opened the conversation.</p></div></div>}
      </aside>
    </div>

    {showGroupModal?<div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">New Group</div><div className="text-lg font-black">Create a conversation group</div></div><button onClick={()=>setShowGroupModal(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900"><X className="h-5 w-5"/></button></div><div className="p-5"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Group name</label><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="e.g. VDRL Review Team" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"/><div className="mb-2 mt-5 flex items-center justify-between"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">Select members</label><span className="text-[11px] text-slate-400">{groupSelection.length} selected</span></div><div className="max-h-[320px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{users.map(u=>{const checked=groupSelection.includes(u.id);return <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900"><input type="checkbox" checked={checked} onChange={()=>setGroupSelection(x=>checked?x.filter(id=>id!==u.id):[...x,u.id])} className="h-4 w-4 rounded border-slate-300"/><div className="relative h-9 w-9 overflow-hidden rounded-full bg-slate-100 text-center text-[11px] font-black leading-9 dark:bg-slate-800">{u.avatar_url?<img src={u.avatar_url} className="h-full w-full object-cover" alt=""/>:initials(u)}<span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${online.has(u.id)?"bg-emerald-500":"bg-slate-300"}`}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{name(u)}</div><div className={`text-[11px] ${online.has(u.id)?"font-bold text-emerald-600":"text-slate-400"}`}>{online.has(u.id)?"Online":"Offline"}</div></div></label>})}</div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowGroupModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button><button onClick={()=>void createGroup()} disabled={creatingGroup||!groupName.trim()||groupSelection.length<1} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{creatingGroup?"Creating…":"Create Group"}</button></div></div></div></div>:null}
  </div>
}
