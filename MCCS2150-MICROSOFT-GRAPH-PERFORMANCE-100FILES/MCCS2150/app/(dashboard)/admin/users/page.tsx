import { microsoftMailboxConnected, outlookEmailConfigured } from "@/lib/mccs/auth";
import { createClient } from "@/lib/supabase/server";
import { UserForm } from "./user-form";
import { UserManager } from "./user-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{outlook?:string;outlook_error?:string}> }) {
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;

  const roleResult = await supabase
    .from("roles")
    .select("role_code,role_name")
    .eq("is_active", true)
    .order("role_name");

  const roles = roleResult.data ?? [];
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const emailConfigured = outlookEmailConfigured();
  const mailboxConnected = await microsoftMailboxConnected();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
        Super Admin
      </div>
      <h1 className="mt-2 text-3xl font-bold">Create Team Account</h1>
      <p className="mt-2 mb-7 text-sm text-slate-500">
        Create users and assign their initial authorization role.
      </p>

      {roleResult.error ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Role list could not be loaded: {roleResult.error.message}
        </div>
      ) : null}

      {!roles.length && !roleResult.error ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No authorization roles are available yet. Run the latest MCCS RLS/authorization migration in Supabase, then sign out and sign back in.
        </div>
      ) : null}

      <UserForm roles={roles} disabled={!serviceRoleConfigured || !roles.length} />
      {query.outlook === "connected" ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Microsoft Outlook connected successfully. MCCS can now send notification emails.</div> : null}
      {query.outlook_error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Outlook connection failed: {query.outlook_error}</div> : null}
      {!emailConfigured ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Microsoft Graph email needs <b>MICROSOFT_CLIENT_ID</b> and <b>MICROSOFT_CLIENT_SECRET</b> in Vercel.</div> : mailboxConnected ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span>MCCS Microsoft Graph email is connected and ready.</span><a href="/api/microsoft/connect" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-bold">Reconnect Outlook</a></div> : <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><span>Configuration detected. Connect the MCCS Outlook mailbox once to authorize secure email delivery.</span><a href="/api/microsoft/connect" className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white">Connect Microsoft Outlook</a></div>}

      <div className="mt-8"><div className="mb-4"><h2 className="text-2xl font-bold">User Directory & Authority</h2><p className="mt-1 text-sm text-slate-500">Change roles, suspend, activate, reset password or delete accounts.</p></div><UserManager /></div>

      {serviceRoleConfigured ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Server admin credential detected. Team-account creation is enabled.
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Missing server-only Vercel variable <b>SUPABASE_SERVICE_ROLE_KEY</b>. Add it to the same Vercel project/environment and redeploy.
        </div>
      )}
    </div>
  );
}
