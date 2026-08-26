import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, requireUser } from "@/lib/mccs/auth";

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
