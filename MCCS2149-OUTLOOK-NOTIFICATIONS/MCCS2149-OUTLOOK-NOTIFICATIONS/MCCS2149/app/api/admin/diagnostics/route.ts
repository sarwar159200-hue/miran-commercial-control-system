import { NextRequest, NextResponse } from "next/server";
import { mccsAppUrl, requireSuperAdmin, requireUser, sendMccsEmail } from "@/lib/mccs/auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function adminClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createAdminClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

function esc(value:unknown){return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("mode") === "webrtc") {
      const { supabase, user } = await requireUser();
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
      if (profile?.is_active === false) return NextResponse.json({ error: "Your MCCS account is suspended." }, { status: 403 });
      const stunUrls=(process.env.WEBRTC_STUN_URLS||"stun:stun.l.google.com:19302").split(",").map(x=>x.trim()).filter(Boolean);
      const iceServers:any[] = stunUrls.length ? [{ urls: stunUrls }] : [];
      const turnUrls=(process.env.WEBRTC_TURN_URLS||"").split(",").map(x=>x.trim()).filter(Boolean);
      if(turnUrls.length){const username=process.env.WEBRTC_TURN_USERNAME||"";const credential=process.env.WEBRTC_TURN_CREDENTIAL||"";if(!username||!credential)return NextResponse.json({error:"TURN URLs are configured but TURN credentials are missing."},{status:500});iceServers.push({urls:turnUrls,username,credential})}
      return NextResponse.json({ iceServers }, { headers: { "Cache-Control": "no-store" } });
    }
    await requireSuperAdmin();
    return NextResponse.json({
      supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      publishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      environment: process.env.VERCEL_ENV || "unknown",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run diagnostics" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if(request.nextUrl.searchParams.get("mode")!=="unread-reminder")return NextResponse.json({error:"Unsupported diagnostics action."},{status:404});
    const expected=String(process.env.MCCS_REMINDER_SECRET||"");
    const supplied=String(request.headers.get("x-mccs-reminder-secret")||"");
    if(!expected||!supplied||supplied!==expected)return NextResponse.json({error:"Unauthorized reminder request."},{status:401});
    const admin=adminClient();
    const {data,error}=await admin.rpc("mccs_pending_unread_email_reminders");
    if(error)throw error;
    const pending=(data||[]) as Array<{recipient_id:string;email:string;recipient_name:string;unread_count:number;message_ids:string[]}>;
    let sent=0; const failures:string[]=[]; const login=mccsAppUrl();
    for(const row of pending.slice(0,50)){
      if(!row.email||!Array.isArray(row.message_ids)||!row.message_ids.length)continue;
      const count=Number(row.unread_count||row.message_ids.length||0);
      try{
        await sendMccsEmail({to:row.email,subject:`MCCS: ${count} unread message${count===1?"":"s"} waiting for you`,html:`<div style="font-family:Arial,sans-serif;color:#122033;line-height:1.55;max-width:650px;margin:auto"><h2 style="color:#0b4edb">MCCS unread message reminder</h2><p>Dear ${esc(row.recipient_name||row.email)},</p><p>You have <b>${count} unread MCCS message${count===1?"":"s"}</b> that have been waiting for more than two hours.</p><p>Please open MCCS when convenient to review and respond.</p>${login?`<p style="margin:24px 0"><a href="${esc(login)}/messages" style="display:inline-block;background:#07111f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Open MCCS Messages</a></p>`:""}<p style="font-size:12px;color:#64748b">This reminder is sent once for each unread message.</p><p style="margin-top:24px">Best Regards,<br><b>MCCS Administration</b></p></div>`});
        await admin.from("chat_email_reminders").upsert(row.message_ids.map(message_id=>({message_id,recipient_id:row.recipient_id,sent_at:new Date().toISOString()})),{onConflict:"message_id,recipient_id",ignoreDuplicates:true});
        sent++;
      }catch(e:any){failures.push(`${row.email}: ${String(e?.message||e).slice(0,180)}`)}
    }
    return NextResponse.json({ok:true,recipients_checked:pending.length,emails_sent:sent,failures});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to send unread reminders"},{status:500});
  }
}

