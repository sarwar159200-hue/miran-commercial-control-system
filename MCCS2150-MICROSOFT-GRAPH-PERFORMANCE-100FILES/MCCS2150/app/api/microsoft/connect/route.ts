import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { mccsAppUrl, requireSuperAdmin } from "@/lib/mccs/auth";

export async function GET() {
  try {
    await requireSuperAdmin();
    const clientId = String(process.env.MICROSOFT_CLIENT_ID || "");
    if (!clientId) return NextResponse.json({ error: "MICROSOFT_CLIENT_ID is missing in Vercel." }, { status: 500 });
    const state = randomBytes(24).toString("hex");
    const store = await cookies();
    store.set("mccs_ms_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    const redirectUri = `${mccsAppUrl()}/api/microsoft/callback`;
    const p = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, response_mode: "query", scope: "offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read", state, prompt: "select_account" });
    return NextResponse.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${p}`);
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 403 }); }
}
