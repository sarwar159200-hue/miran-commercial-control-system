"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileText, MessageCircle, Mic, MicOff, Paperclip, Phone, Search, Send, Share2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getWebRtcIceServers, uploadChatVoice } from "@/app/(dashboard)/_actions/commercial";

type Profile={id:string;full_name?:string|null;preferred_name?:string|null;avatar_url?:string|null;last_seen_at?:string|null};
type Msg={id:string;sender_id:string;recipient_id?:string|null;group_id?:string|null;body:string;created_at:string;read_at?:string|null;attachment_document_id?:string|null;message_type?:string|null};
type Call={id:string;caller_id:string;receiver_id:string;status:string;call_type:string;started_at?:string|null;answered_at?:string|null;ended_at?:string|null;screen_shared?:boolean};
type Signal={id:number;call_id:string;sender_id:string;recipient_id:string;signal_type:string;payload:any};
type Doc={id:string;document_title?:string|null;file_name?:string|null;vendor_id?:string|null;vendor_name?:string|null};
function pname(p?:Profile|null){return p?.preferred_name?.trim()||p?.full_name?.trim()||"MCCS User"}
function initials(p?:Profile|null){const a=pname(p).split(/\s+/);return `${a[0]?.[0]||"U"}${a[1]?.[0]||a[0]?.[1]||""}`.toUpperCase()}
function dur(s:number){return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`}

export function PresenceHeartbeat(){
  const supabase=useMemo(()=>createClient(),[]); const [me,setMe]=useState(""); const [profiles,setProfiles]=useState<Profile[]>([]); const [online,setOnline]=useState<Set<string>>(new Set());
  const [open,setOpen]=useState(false); const [selected,setSelected]=useState(""); const [messages,setMessages]=useState<Msg[]>([]); const [reply,setReply]=useState(""); const [unread,setUnread]=useState(0); const [search,setSearch]=useState(""); const [docs,setDocs]=useState<Doc[]>([]); const [attachment,setAttachment]=useState("");
  const [incoming,setIncoming]=useState<Call|null>(null); const [activeCall,setActiveCall]=useState<Call|null>(null); const [callStatus,setCallStatus]=useState(""); const [muted,setMuted]=useState(false); const [sharing,setSharing]=useState(false); const [seconds,setSeconds]=useState(0); const [notice,setNotice]=useState("");
  const [voiceRecording,setVoiceRecording]=useState(false); const [voicePreview,setVoicePreview]=useState<{blob:Blob;url:string;duration:number}|null>(null); const voiceRec=useRef<MediaRecorder|null>(null); const voiceChunks=useRef<Blob[]>([]); const voiceStream=useRef<MediaStream|null>(null); const voiceStarted=useRef(0);
  const pc=useRef<RTCPeerConnection|null>(null); const mic=useRef<MediaStream|null>(null); const screen=useRef<MediaStream|null>(null); const remoteAudio=useRef<HTMLAudioElement>(null); const remoteVideo=useRef<HTMLVideoElement>(null); const callId=useRef(""); const partner=useRef(""); const timer=useRef<number|null>(null); const callStarted=useRef(0);

  const loadConversation=async(uid:string)=>{if(!me||!uid)return;const filter=`and(sender_id.eq.${me},recipient_id.eq.${uid}),and(sender_id.eq.${uid},recipient_id.eq.${me})`;const {data}=await supabase.from("chat_messages").select("id,sender_id,recipient_id,body,created_at,read_at,attachment_document_id,message_type").or(filter).order("created_at",{ascending:false}).limit(30);setMessages(((data||[]) as Msg[]).reverse());await supabase.from("chat_messages").update({read_at:new Date().toISOString()}).eq("sender_id",uid).eq("recipient_id",me).is("read_at",null);void refreshUnread()};
  const refreshUnread=async()=>{if(!me)return;const {count}=await supabase.from("chat_messages").select("id",{count:"exact",head:true}).eq("recipient_id",me).is("read_at",null);setUnread(count||0)};

  useEffect(()=>{let alive=true;void(async()=>{const {data}=await supabase.auth.getUser();const uid=data.user?.id||"";if(!uid||!alive)return;setMe(uid);const [{data:p},{data:d},{data:v}]=await Promise.all([supabase.from("profiles").select("id,full_name,preferred_name,avatar_url,last_seen_at").neq("id",uid).order("full_name"),supabase.from("documents").select("id,document_title,file_name,vendor_id").eq("is_deleted",false).neq("document_category","chat_voice").order("uploaded_at",{ascending:false}).limit(100),supabase.from("vendors").select("id,vendor_name")]);setProfiles((p||[]) as Profile[]);const vm=new Map((v||[]).map((x:any)=>[String(x.id),String(x.vendor_name||"")]));setDocs(((d||[]) as any[]).map(x=>({...x,vendor_name:vm.get(String(x.vendor_id||""))||"Unassigned Supplier"})));void refreshUnread();void supabase.rpc("touch_presence")})();return()=>{alive=false}},[supabase]);

  useEffect(()=>{if(!me)return;const t=window.setInterval(()=>void supabase.rpc("touch_presence"),45000);return()=>window.clearInterval(t)},[me,supabase]);
  useEffect(()=>{if(!me)return;const refresh=()=>void refreshUnread();window.addEventListener("mccs:refresh-unread",refresh);return()=>window.removeEventListener("mccs:refresh-unread",refresh)},[me]);
  useEffect(()=>{if(!me)return;const ch=supabase.channel("mccs-user-presence",{config:{presence:{key:me}}});
    const publish=()=>{const next=new Set(Object.keys(ch.presenceState()));setOnline(next);window.dispatchEvent(new CustomEvent("mccs:presence",{detail:{online:Array.from(next)}}))};
    const request=()=>publish();window.addEventListener("mccs:presence-request",request);
    ch.on("presence",{event:"sync"},publish).on("presence",{event:"join"},publish).on("presence",{event:"leave"},publish);
    ch.subscribe(async status=>{if(status==="SUBSCRIBED"){await ch.track({user_id:me,online_at:new Date().toISOString()});publish()}});
    return()=>{window.removeEventListener("mccs:presence-request",request);void ch.untrack();void supabase.removeChannel(ch)}},[me,supabase]);

  useEffect(()=>{if(!me)return;const ch=supabase.channel(`mccs-global-comms-${me}`)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:`recipient_id=eq.${me}`},(p:any)=>{const m=p.new as Msg;setUnread(x=>x+1);setNotice(`${pname(profiles.find(x=>x.id===m.sender_id))}: ${m.message_type==="voice"?"🎤 Voice message":m.body||"Shared a document"}`);window.setTimeout(()=>setNotice(""),4500);if(open&&selected===m.sender_id){setMessages(x=>[...x,m]);void supabase.from("chat_messages").update({read_at:new Date().toISOString()}).eq("id",m.id);setUnread(x=>Math.max(0,x-1))}})
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"chat_messages"},(p:any)=>{const m=p.new as Msg;if(m.sender_id!==me&&m.recipient_id!==me)return;setMessages(x=>x.map(v=>v.id===m.id?{...v,...m}:v))})
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_calls",filter:`receiver_id=eq.${me}`},(p:any)=>{const c=p.new as Call;if(["calling","ringing"].includes(c.status)){setIncoming(c);partner.current=c.caller_id}})
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"chat_calls"},(p:any)=>{const c=p.new as Call;if(c.caller_id!==me&&c.receiver_id!==me)return;if(callId.current===c.id&&["declined","cancelled","missed","ended","failed"].includes(c.status))cleanup(c.status);if(incoming?.id===c.id&&!['calling','ringing'].includes(c.status))setIncoming(null)})
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_call_signals",filter:`recipient_id=eq.${me}`},(p:any)=>void handleSignal(p.new as Signal)).subscribe();return()=>{void supabase.removeChannel(ch)}},[me,open,selected,profiles,incoming?.id,supabase]);

  useEffect(()=>{const handler=(e:any)=>{const uid=String(e?.detail?.userId||"");if(uid)void startCall(uid)};window.addEventListener("mccs:start-voice-call",handler as EventListener);return()=>window.removeEventListener("mccs:start-voice-call",handler as EventListener)},[me]);

  async function sendSignal(id:string,to:string,type:string,payload:any){await supabase.from("chat_call_signals").insert({call_id:id,sender_id:me,recipient_id:to,signal_type:type,payload})}
  async function peerFor(id:string,to:string){if(pc.current)return pc.current;const iceServers=await getWebRtcIceServers();const p=new RTCPeerConnection({iceServers});pc.current=p;callId.current=id;partner.current=to;p.onicecandidate=e=>{if(e.candidate)void sendSignal(id,to,"ice",e.candidate.toJSON())};p.ontrack=e=>{const s=e.streams[0];if(e.track.kind==="audio"&&remoteAudio.current){remoteAudio.current.srcObject=s;void remoteAudio.current.play().catch(()=>{})}if(e.track.kind==="video"&&remoteVideo.current){remoteVideo.current.srcObject=s;setSharing(true)}};p.onconnectionstatechange=()=>{if(p.connectionState==="connected"){setCallStatus("Connected");startTimer()}else if(["connecting","disconnected"].includes(p.connectionState))setCallStatus("Reconnecting...");else if(p.connectionState==="failed")void finishCall("failed")};return p}
  async function getMic(){if(mic.current)return mic.current;try{mic.current=await navigator.mediaDevices.getUserMedia({audio:true,video:false});return mic.current}catch{throw new Error("Microphone access is required for voice calling.")}}
  async function addMic(p:RTCPeerConnection){const s=await getMic();for(const t of s.getAudioTracks())if(!p.getSenders().some(x=>x.track?.id===t.id))p.addTrack(t,s)}
  async function startCall(uid:string){if(!me||!uid||activeCall)return;setSelected(uid);setOpen(true);try{const {data:c,error}=await supabase.from("chat_calls").insert({caller_id:me,receiver_id:uid,call_type:"voice",status:"ringing",ringing_at:new Date().toISOString()}).select("*").single();if(error||!c)throw error||new Error("Unable to start call");setActiveCall(c as Call);setCallStatus("Ringing…");const p=await peerFor(c.id,uid);await addMic(p);const offer=await p.createOffer();await p.setLocalDescription(offer);await sendSignal(c.id,uid,"offer",offer);window.setTimeout(async()=>{if(callId.current===c.id&&p.connectionState!=="connected"){await supabase.from("chat_calls").update({status:"missed",missed:true,ended_at:new Date().toISOString(),ended_by:me}).eq("id",c.id);cleanup("Missed")}},45000)}catch(e:any){setNotice(e?.message||"Voice call failed");cleanup("Failed")}}
  async function accept(){const c=incoming;if(!c)return;setIncoming(null);setActiveCall(c);setOpen(true);setSelected(c.caller_id);try{const p=await peerFor(c.id,c.caller_id);await addMic(p);const {data:s}=await supabase.from("chat_call_signals").select("*").eq("call_id",c.id).eq("recipient_id",me).order("id",{ascending:true});const sigs=(s||[]) as Signal[];const offer=sigs.filter(x=>x.signal_type==="offer").at(-1)?.payload;if(!offer)throw new Error("Call offer was not received.");await p.setRemoteDescription(new RTCSessionDescription(offer));for(const ice of sigs.filter(x=>x.signal_type==="ice")){try{await p.addIceCandidate(new RTCIceCandidate(ice.payload))}catch{}}const ans=await p.createAnswer();await p.setLocalDescription(ans);await sendSignal(c.id,c.caller_id,"answer",ans);await supabase.from("chat_calls").update({status:"connected",answered_at:new Date().toISOString(),started_at:new Date().toISOString()}).eq("id",c.id);setCallStatus("Connected");startTimer()}catch(e:any){setNotice(e?.message||"Unable to accept call");void finishCall("failed")}}
  async function decline(){if(!incoming)return;await supabase.from("chat_calls").update({status:"declined",ended_at:new Date().toISOString(),ended_by:me}).eq("id",incoming.id);setIncoming(null)}
  async function handleSignal(s:Signal){if(s.signal_type==="hangup"){cleanup("Ended");return}if(s.signal_type==="screen-start")setSharing(true);if(s.signal_type==="screen-stop")setSharing(false);if(s.signal_type==="offer"){if(callId.current!==s.call_id)return;const p=await peerFor(s.call_id,s.sender_id);await addMic(p);await p.setRemoteDescription(new RTCSessionDescription(s.payload));const a=await p.createAnswer();await p.setLocalDescription(a);await sendSignal(s.call_id,s.sender_id,"answer",a);return}if(callId.current!==s.call_id||!pc.current)return;if(s.signal_type==="answer")await pc.current.setRemoteDescription(new RTCSessionDescription(s.payload));else if(s.signal_type==="ice")try{await pc.current.addIceCandidate(new RTCIceCandidate(s.payload))}catch{}}
  function startTimer(){if(timer.current)return;callStarted.current=Date.now();timer.current=window.setInterval(()=>setSeconds(Math.floor((Date.now()-callStarted.current)/1000)),1000)}
  function toggleMute(){const t=mic.current?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;setMuted(!t.enabled)}}
  async function share(){if(!pc.current||!callId.current)return;try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screen.current=s;const t=s.getVideoTracks()[0];pc.current.addTrack(t,s);setSharing(true);await supabase.from("chat_calls").update({screen_shared:true}).eq("id",callId.current);await sendSignal(callId.current,partner.current,"screen-start",{});t.onended=()=>void stopShare();const o=await pc.current.createOffer();await pc.current.setLocalDescription(o);await sendSignal(callId.current,partner.current,"offer",o)}catch{setNotice("Screen sharing was cancelled.")}}
  async function stopShare(){if(!screen.current)return;for(const t of screen.current.getTracks()){const s=pc.current?.getSenders().find(x=>x.track===t);if(s)pc.current?.removeTrack(s);t.stop()}screen.current=null;setSharing(false);if(callId.current){await supabase.from("chat_calls").update({screen_shared:false}).eq("id",callId.current);await sendSignal(callId.current,partner.current,"screen-stop",{});if(pc.current){const o=await pc.current.createOffer();await pc.current.setLocalDescription(o);await sendSignal(callId.current,partner.current,"offer",o)}}}
  async function finishCall(status="ended"){const id=callId.current;const to=partner.current;if(id){if(to)await sendSignal(id,to,"hangup",{});await supabase.from("chat_calls").update({status,ended_at:new Date().toISOString(),duration_seconds:seconds,ended_by:me,screen_shared:sharing}).eq("id",id);if(to)await supabase.from("chat_messages").insert({sender_id:me,recipient_id:to,body:`📞 Voice call${sharing?" · Screen shared":""} · ${dur(seconds)}`,message_type:"call"})}cleanup(status)}
  function cleanup(status:string){pc.current?.close();pc.current=null;mic.current?.getTracks().forEach(t=>t.stop());mic.current=null;screen.current?.getTracks().forEach(t=>t.stop());screen.current=null;if(timer.current)window.clearInterval(timer.current);timer.current=null;callId.current="";partner.current="";setActiveCall(null);setCallStatus(status);setMuted(false);setSharing(false);setSeconds(0);if(remoteAudio.current)remoteAudio.current.srcObject=null;if(remoteVideo.current)remoteVideo.current.srcObject=null}

  async function startVoice(){if(voiceRecording||!selected)return;try{const st=await navigator.mediaDevices.getUserMedia({audio:true,video:false});voiceStream.current=st;const mime=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";const r=new MediaRecorder(st,{mimeType:mime});voiceRec.current=r;voiceChunks.current=[];voiceStarted.current=Date.now();r.ondataavailable=e=>{if(e.data.size)voiceChunks.current.push(e.data)};r.onstop=()=>{const blob=new Blob(voiceChunks.current,{type:r.mimeType});const duration=Math.max(1,Math.round((Date.now()-voiceStarted.current)/1000));if(blob.size)setVoicePreview({blob,url:URL.createObjectURL(blob),duration});voiceStream.current?.getTracks().forEach(t=>t.stop());voiceStream.current=null;setVoiceRecording(false)};r.start(250);setVoiceRecording(true)}catch{setNotice("Microphone access is required to record a voice message.")}}
  function stopVoice(){if(voiceRec.current?.state==="recording")voiceRec.current.stop()}
  async function sendVoice(){if(!voicePreview||!selected)return;const fd=new FormData();fd.append("recipient_id",selected);fd.append("duration_seconds",String(voicePreview.duration));fd.append("waveform","[]");fd.append("voice",new File([voicePreview.blob],`voice-${Date.now()}.webm`,{type:voicePreview.blob.type||"audio/webm"}));try{const m=await uploadChatVoice(fd) as Msg;setMessages(x=>[...x,m]);URL.revokeObjectURL(voicePreview.url);setVoicePreview(null)}catch(e:any){setNotice(e?.message||"Voice message could not be sent.")}}

  async function send(){const body=reply.trim();if(!body||!selected)return;const {data,error}=await supabase.from("chat_messages").insert({sender_id:me,recipient_id:selected,body,attachment_document_id:attachment||null,message_type:"text"}).select("*").single();if(error){setNotice(error.message);return}setReply("");setAttachment("");if(data)setMessages(x=>[...x,data as Msg])}
  const filtered=profiles.filter(p=>pname(p).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(online.has(b.id))-Number(online.has(a.id))||pname(a).localeCompare(pname(b)));
  return <>
    {notice?<div className="fixed right-6 top-24 z-[140] max-w-[360px] rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">{notice}</div>:null}
    <div className="fixed bottom-5 right-5 z-[100]">
      {open?<div className="flex h-[560px] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white"><div><div className="text-sm font-black">MCCS Chat</div><div className="text-[10px] text-slate-300">{online.size} users online</div></div><div className="flex items-center gap-2"><a href={selected?`/messages?user=${selected}`:"/messages"} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-bold">Open Full Messages</a><button onClick={()=>setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/10"><X className="h-4 w-4"/></button></div></div>
        {!selected?<><div className="p-3"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"/></div></div><div className="flex-1 overflow-y-auto px-2 pb-3">{filtered.map(p=><button key={p.id} onClick={()=>{setSelected(p.id);void loadConversation(p.id)}} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900"><div className="relative h-10 w-10 shrink-0 rounded-full bg-slate-100 text-center text-xs font-black leading-10 dark:bg-slate-800">{p.avatar_url?<img src={p.avatar_url} className="h-full w-full rounded-full object-cover" alt=""/>:initials(p)}<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${online.has(p.id)?"bg-emerald-500":"bg-slate-300"}`}/></div><div className="min-w-0"><div className="truncate text-sm font-extrabold">{pname(p)}</div><div className={`text-xs ${online.has(p.id)?"font-bold text-emerald-600":"text-slate-400"}`}>{online.has(p.id)?"Online":"Offline"}</div></div></button>)}</div></>:
        <><div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800"><button onClick={()=>setSelected("")} className="text-xs font-bold text-blue-600">← Users</button><div className="text-center"><div className="text-sm font-black">{pname(profiles.find(p=>p.id===selected))}</div><div className={`text-[10px] font-bold ${online.has(selected)?"text-emerald-600":"text-slate-400"}`}>{online.has(selected)?"● Online":"Offline"}</div></div><button onClick={()=>void startCall(selected)} className="rounded-lg border border-blue-200 p-2 text-blue-600"><Phone className="h-4 w-4"/></button></div><div className="flex-1 overflow-y-auto p-3">{messages.map(m=><div key={m.id} className={`mb-2 flex ${m.sender_id===me?"justify-end":"justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs ${m.sender_id===me?"bg-blue-600 text-white":"bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white"}`}><div>{m.message_type==="voice"?"🎤 Voice message":m.body||"Shared document"}</div>{m.sender_id===me?<div className="mt-1 text-right text-[9px] opacity-80">{m.read_at?"✓✓ Seen":"✓ Delivered"}</div>:null}</div></div>)}</div><div className="border-t border-slate-200 p-3 dark:border-slate-800"><div className="mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4 text-slate-400"/><select value={attachment} onChange={e=>setAttachment(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-900"><option value="">Attach document</option>{docs.map(d=><option key={d.id} value={d.id}>{d.vendor_name} — {d.document_title||d.file_name}</option>)}</select></div>{voiceRecording?<div className="mb-2 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"><span>Recording voice message…</span><button onClick={stopVoice} className="rounded-lg bg-rose-600 px-2 py-1 text-white">Stop</button></div>:null}{voicePreview?<div className="mb-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2"><audio controls src={voicePreview.url} className="h-8 min-w-0 flex-1"/><button onClick={()=>{URL.revokeObjectURL(voicePreview.url);setVoicePreview(null)}} className="text-xs font-bold">Delete</button><button onClick={()=>void sendVoice()} className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-bold text-white">Send</button></div>:null}<div className="flex gap-2"><input value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void send()}}} placeholder="Type a message..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"/><button onClick={()=>void startVoice()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 text-blue-600"><Mic className="h-4 w-4"/></button><button onClick={()=>void send()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Send className="h-4 w-4"/></button></div></div></>}
      </div>:<button onClick={()=>setOpen(true)} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl hover:bg-blue-700" aria-label="Open MCCS chat"><MessageCircle className="h-6 w-6"/>{unread>0?<span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black">{unread>99?"99+":unread}</span>:null}<span className="absolute -left-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"/></button>}
    </div>
    {incoming?<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm"><div className="w-[360px] rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900"><div className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Incoming Voice Call</div><div className="mx-auto mt-5 h-20 w-20 rounded-full bg-slate-100 text-xl font-black leading-[80px] dark:bg-slate-800">{initials(profiles.find(p=>p.id===incoming.caller_id))}</div><div className="mt-3 text-xl font-black">{pname(profiles.find(p=>p.id===incoming.caller_id))}</div><div className="mt-6 flex gap-3"><button onClick={()=>void decline()} className="flex-1 rounded-xl bg-rose-50 py-3 font-bold text-rose-700">Decline</button><button onClick={()=>void accept()} className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white">Accept</button></div></div></div>:null}
    {activeCall?<div className="fixed bottom-6 left-1/2 z-[145] w-[430px] -translate-x-1/2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"><div className="bg-slate-950 p-4 text-white"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-blue-300">Voice Call</div><div className="text-lg font-black">{pname(profiles.find(p=>p.id===partner.current))}</div><div className="text-xs text-slate-300">{callStatus} · {dur(seconds)}</div></div>{sharing?<div className="relative bg-black"><video ref={remoteVideo} autoPlay playsInline className="max-h-[230px] w-full object-contain"/><div className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-black text-white">SCREEN SHARING</div></div>:null}<audio ref={remoteAudio} autoPlay/><div className="grid grid-cols-3 gap-2 p-4"><button onClick={toggleMute} className="rounded-xl border border-slate-200 p-3 text-xs font-bold dark:border-slate-700">{muted?<MicOff className="mx-auto mb-1 h-5 w-5"/>:<Mic className="mx-auto mb-1 h-5 w-5"/>}{muted?"Unmute":"Mute"}</button><button onClick={()=>void(sharing?stopShare():share())} className="rounded-xl border border-slate-200 p-3 text-xs font-bold dark:border-slate-700"><Share2 className="mx-auto mb-1 h-5 w-5"/>{sharing?"Stop Sharing":"Share Screen"}</button><button onClick={()=>void finishCall("ended")} className="rounded-xl bg-rose-600 p-3 text-xs font-bold text-white"><Phone className="mx-auto mb-1 h-5 w-5 rotate-[135deg]"/>End</button></div></div>:null}
  </>
}

const MCCS_TAB_PATHS:Array<[string,string]>=[["administration","/admin"],["payment_milestones","/payment-milestones"],["purchase_orders","/purchase-orders"],["dashboard","/dashboard"],["vendors","/vendors"],["projects","/projects"],["invoices","/invoices"],["payments","/payments"],["vdrl","/vdrl"],["documents","/documents"],["reports","/reports"],["messages","/messages"]];

export function VdrlTableController({children}:{children:any}){
  const ref=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const host=ref.current;
    if(!host)return;
    const table=host.querySelector<HTMLTableElement>("table.vdrl-resizable-table");
    if(!table)return;
    const headers=Array.from(table.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th"));
    if(!headers.length)return;

    // A real colgroup is required for reliable resizing with table-layout: fixed,
    // especially because the first VDRL header row contains IFR/IFA/IFC colspans.
    table.querySelector('colgroup[data-vdrl-generated="1"]')?.remove();
    const colgroup=document.createElement("colgroup");
    colgroup.dataset.vdrlGenerated="1";
    const savedRaw=window.localStorage.getItem("mccs:vdrl-column-widths");
    let saved:number[]=[];
    try{saved=savedRaw?JSON.parse(savedRaw):[]}catch{saved=[]}
    const measured=headers.map((h,i)=>{
      const fromStore=Number(saved[i]||0);
      return fromStore>=72?Math.min(620,fromStore):Math.max(82,Math.round(h.getBoundingClientRect().width));
    });
    const cols=measured.map(w=>{
      const c=document.createElement("col");
      c.style.width=`${w}px`;
      colgroup.appendChild(c);
      return c;
    });
    table.insertBefore(colgroup,table.firstChild);
    let widths=[...measured];
    const applyTableWidth=()=>{
      const total=widths.reduce((a,b)=>a+b,0);
      table.style.tableLayout="fixed";
      table.style.width=`${total}px`;
      table.style.minWidth=`${total}px`;
    };
    applyTableWidth();

    const cleanups:(()=>void)[]=[];
    headers.forEach((h,i)=>{
      h.dataset.vdrlResizable="1";
      h.style.position="sticky";
      h.querySelector(".vdrl-resize-handle")?.remove();
      const handle=document.createElement("span");
      handle.className="vdrl-resize-handle";
      handle.title="Drag to resize column";
      h.appendChild(handle);
      const down=(ev:PointerEvent)=>{
        ev.preventDefault();ev.stopPropagation();
        const startX=ev.clientX,startW=widths[i];
        document.body.classList.add("vdrl-column-resizing");
        handle.setPointerCapture?.(ev.pointerId);
        const move=(e:PointerEvent)=>{
          const w=Math.max(72,Math.min(620,startW+(e.clientX-startX)));
          widths[i]=Math.round(w);
          cols[i].style.width=`${widths[i]}px`;
          applyTableWidth();
        };
        const up=()=>{
          document.body.classList.remove("vdrl-column-resizing");
          window.localStorage.setItem("mccs:vdrl-column-widths",JSON.stringify(widths));
          window.removeEventListener("pointermove",move);
          window.removeEventListener("pointerup",up);
        };
        window.addEventListener("pointermove",move);
        window.addEventListener("pointerup",up,{once:true});
      };
      handle.addEventListener("pointerdown",down);
      cleanups.push(()=>handle.removeEventListener("pointerdown",down));
    });
    return()=>{cleanups.forEach(fn=>fn());document.body.classList.remove("vdrl-column-resizing")};
  },[]);
  return <div ref={ref} className="vdrl-table-controller">{children}</div>;
}

export function AccessGuard({children,allowedTabs,canAdmin}:{children:React.ReactNode;allowedTabs:string[];canAdmin:boolean}){const pathname=usePathname(),router=useRouter();useEffect(()=>{if(!allowedTabs.length)return;const match=MCCS_TAB_PATHS.find(([,path])=>pathname===path||pathname.startsWith(`${path}/`));if(!match)return;const[key]=match;const ok=(key==="administration"?canAdmin:true)&&allowedTabs.includes(key);if(!ok){const first=MCCS_TAB_PATHS.find(([k])=>allowedTabs.includes(k)&&(k!=="administration"||canAdmin));router.replace(first?.[1]||"/login")}},[pathname,allowedTabs.join("|"),canAdmin,router]);return <>{children}</>}
