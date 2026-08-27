import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { mccsAppUrl, requireSuperAdmin } from "@/lib/mccs/auth";

export async function GET(request: Request) {
  try {
    const { user } = await requireSuperAdmin();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const store = await cookies();
    const expected = store.get("mccs_ms_oauth_state")?.value;
    store.delete("mccs_ms_oauth_state");
    if (!code || !state || !expected || state !== expected) throw new Error("Microsoft authorization state was invalid or expired. Please try Connect Outlook again.");
    const clientId = String(process.env.MICROSOFT_CLIENT_ID || "");
    const clientSecret = String(process.env.MICROSOFT_CLIENT_SECRET || "");
    const redirectUri = `${mccsAppUrl()}/api/microsoft/callback`;
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri, scope: "offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read" });
    const tr = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
    const token = await tr.json();
    if (!tr.ok || !token.access_token || !token.refresh_token) throw new Error(String(token.error_description || token.error || "Microsoft token exchange failed."));
    const me = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" });
    const profile = await me.json();
    if (!me.ok) throw new Error("Microsoft mailbox profile could not be read.");
    const admin = createAdminClient(String(process.env.NEXT_PUBLIC_SUPABASE_URL), String(process.env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false, autoRefreshToken: false } });
    const email = String(profile.mail || profile.userPrincipalName || "");
    const { error } = await admin.from("mccs_email_oauth").upsert({ provider: "microsoft", email_address: email, refresh_token: token.refresh_token, connected_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "provider" });
    if (error) throw error;
    return NextResponse.redirect(`${mccsAppUrl()}/admin/users?outlook=connected`);
  } catch (e) {
    return NextResponse.redirect(`${mccsAppUrl()}/admin/users?outlook_error=${encodeURIComponent(e instanceof Error ? e.message : "Microsoft connection failed")}`);
  }
}
