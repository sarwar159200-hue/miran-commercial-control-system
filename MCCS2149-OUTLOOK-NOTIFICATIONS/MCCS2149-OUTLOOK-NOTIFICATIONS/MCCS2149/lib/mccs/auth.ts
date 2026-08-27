import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

export async function requireUser() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return { supabase, user };
}

export async function requireSuperAdmin() {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin,is_active")
    .eq("id", user.id)
    .maybeSingle();

  const emailBootstrap = user.email?.toLowerCase() === "sarwar.khalid@miranenergy.com";

  if ((!profile?.is_super_admin && !emailBootstrap) || profile?.is_active === false) {
    throw new Error("Super Admin permission is required.");
  }

  return { supabase, user };
}


export function mccsAppUrl() {
  const explicit = String(process.env.NEXT_PUBLIC_APP_URL || process.env.MCCS_APP_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "";
}

export function outlookEmailConfigured() {
  return Boolean(process.env.OUTLOOK_SMTP_USER && (process.env.OUTLOOK_SMTP_APP_PASSWORD || process.env.OUTLOOK_SMTP_PASSWORD));
}

export async function sendMccsEmail(input: { to: string; subject: string; html: string }) {
  const user = String(process.env.OUTLOOK_SMTP_USER || "").trim();
  const password = String(process.env.OUTLOOK_SMTP_APP_PASSWORD || process.env.OUTLOOK_SMTP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !password) {
    throw new Error("Outlook email is not configured. Add OUTLOOK_SMTP_USER and OUTLOOK_SMTP_APP_PASSWORD in Vercel.");
  }
  const consumer = /@(outlook|hotmail|live|msn)\./i.test(user);
  const host = String(process.env.OUTLOOK_SMTP_HOST || (consumer ? "smtp-mail.outlook.com" : "smtp.office365.com")).trim();
  const port = Number(process.env.OUTLOOK_SMTP_PORT || 587);
  const from = String(process.env.MCCS_EMAIL_FROM || `MCCS <${user}>`).trim();
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    auth: { user, pass: password },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  try {
    await transport.sendMail({ from, to: input.to, subject: input.subject, html: input.html });
  } catch (error: any) {
    const msg = String(error?.message || error || "Unknown Outlook SMTP error");
    if (/auth|535|5\.7\.|password|login/i.test(msg)) {
      throw new Error("Outlook rejected the sign-in. Use an Outlook/Microsoft account with 2-step verification and an App Password, then put that App Password in OUTLOOK_SMTP_APP_PASSWORD.");
    }
    throw new Error(`Outlook could not send the email: ${msg}`);
  } finally {
    transport.close();
  }
}
