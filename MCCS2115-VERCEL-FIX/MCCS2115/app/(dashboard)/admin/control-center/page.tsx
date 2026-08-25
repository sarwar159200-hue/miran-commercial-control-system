import { redirect } from "next/navigation";
import { Activity, Radio, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControlCenterPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!me?.is_super_admin) redirect("/dashboard");

  const [onlineResult, logsResult] = await Promise.all([
    supabase.from("online_users").select("*").order("last_seen_at", { ascending: false }),
    supabase.from("audit_logs").select("id,actor_user_id,entity_type,action,created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const online = onlineResult.data ?? [];
  const logs = logsResult.data ?? [];

  const ids = Array.from(new Set(logs.map((l: any) => l.actor_user_id).filter(Boolean)));
  const actorsResult = ids.length
    ? await supabase.from("profiles").select("id,full_name,preferred_name").in("id", ids)
    : { data: [] as any[] };

  const actors = actorsResult.data ?? [];
  const names = new Map<string,string>(actors.map((a: any) => [String(a.id), String(a.preferred_name || a.full_name || "User")]));

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Super Admin</div>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Control Center</h1>
      <p className="mt-2 text-sm text-slate-500">Live user presence and commercial action history.</p>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <div className="mccs-card rounded-2xl p-5">
          <Radio className="h-5 w-5 text-emerald-600" />
          <div className="mt-3 text-3xl font-bold">{online.length}</div>
          <div className="mt-1 text-sm text-slate-500">Online now</div>
        </div>
        <div className="mccs-card rounded-2xl p-5">
          <Activity className="h-5 w-5 text-blue-700" />
          <div className="mt-3 text-3xl font-bold">{logs.length}</div>
          <div className="mt-1 text-sm text-slate-500">Recent actions loaded</div>
        </div>
        <div className="mccs-card rounded-2xl p-5">
          <ShieldCheck className="h-5 w-5 text-blue-700" />
          <div className="mt-3 text-sm font-bold text-slate-900">Super Admin protected</div>
          <div className="mt-1 text-sm text-slate-500">Other users are redirected.</div>
        </div>
      </div>

      <section className="mccs-card mt-6 rounded-2xl p-5">
        <h2 className="text-lg font-bold text-slate-950">Online Users</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {online.map((u: any) => (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <div className="font-bold text-slate-900">{u.preferred_name || u.full_name || u.email}</div>
              </div>
              <div className="mt-1 text-xs text-slate-500">{u.email}</div>
              <div className="mt-2 text-xs font-semibold text-slate-500">
                {u.is_super_admin ? "Super Admin" : u.job_title || "User"}
              </div>
            </div>
          ))}
          {!online.length ? <div className="text-sm text-slate-500">No active sessions detected in the last 2 minutes.</div> : null}
        </div>
      </section>

      <section className="mccs-card mt-6 overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Action Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Entity</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="px-5 py-4 text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">{names.get(l.actor_user_id) || "System"}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{l.action}</span></td>
                  <td className="px-5 py-4 text-slate-600">{l.entity_type}</td>
                </tr>
              ))}
              {!logs.length ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">No actions logged yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
