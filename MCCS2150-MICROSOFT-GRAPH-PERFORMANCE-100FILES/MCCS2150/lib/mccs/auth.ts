import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function requireUser() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function requireSuperAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("is_super_admin,is_active").eq("id", user.id).maybeSingle();
  const emailBootstrap = user.email?.toLowerCase() === "sarwar.khalid@miranenergy.com";
  if ((!profile?.is_super_admin && !emailBootstrap) || profile?.is_active === false) throw new Error("Super Admin permission is required.");
  return { supabase, user };
}

export function mccsAppUrl() {
  const explicit = String(process.env.NEXT_PUBLIC_APP_URL || process.env.MCCS_APP_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "";
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function outlookEmailConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function microsoftMailboxConnected() {
  if (!outlookEmailConfigured()) return false;
  try {
    const { data } = await adminClient().from("mccs_email_oauth").select("id").eq("provider", "microsoft").maybeSingle();
    return Boolean(data?.id);
  } catch { return false; }
}

async function graphAccessToken() {
  const admin = adminClient();
  const { data: credential, error } = await admin.from("mccs_email_oauth").select("id,refresh_token,email_address").eq("provider", "microsoft").maybeSingle();
  if (error || !credential?.refresh_token) throw new Error("Microsoft mailbox is not connected. Open Administration and click Connect Microsoft Outlook first.");
  const clientId = String(process.env.MICROSOFT_CLIENT_ID || "");
  const clientSecret = String(process.env.MICROSOFT_CLIENT_SECRET || "");
  if (!clientId || !clientSecret) throw new Error("Microsoft OAuth is not configured in Vercel.");
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: credential.refresh_token, scope: "offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read" });
  const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) throw new Error(`Microsoft authorization needs attention. Reconnect Outlook from Administration. ${String(token.error_description || token.error || "")}`.trim());
  if (token.refresh_token && token.refresh_token !== credential.refresh_token) await admin.from("mccs_email_oauth").update({ refresh_token: token.refresh_token, updated_at: new Date().toISOString() }).eq("id", credential.id);
  return { accessToken: String(token.access_token), email: String(credential.email_address || process.env.MCCS_EMAIL_FROM || "") };
}

export async function sendMccsEmail(input: { to: string; subject: string; html: string }) {
  const { accessToken } = await graphAccessToken();
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: input.subject, body: { contentType: "HTML", content: input.html }, toRecipients: [{ emailAddress: { address: input.to } }] }, saveToSentItems: true }),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft Graph could not send the email (${response.status}). ${text.slice(0, 400)}`);
  }
}
