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

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function brevoEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.MCCS_EMAIL_FROM);
}

function parseSender(value: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) return { name: match[1].trim() || "MCCS – Miran Energy", email: match[2].trim() };
  return { name: "MCCS – Miran Energy", email: raw };
}

export async function sendMccsEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  const sender = parseSender(String(process.env.MCCS_EMAIL_FROM || ""));
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured in Vercel.");
  if (!sender.email) throw new Error("MCCS_EMAIL_FROM is not configured in Vercel.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Brevo could not send the email (${response.status}). ${text.slice(0, 400)}`);
    }
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Brevo email request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
