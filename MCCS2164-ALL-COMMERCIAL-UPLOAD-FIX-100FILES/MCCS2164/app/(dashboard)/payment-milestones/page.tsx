import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";
import MilestoneVendorFilter from "@/components/milestone-vendor-filter";
import { bulkUpdateMilestones, deletePaymentMilestone } from "../_actions/commercial";

export const dynamic = "force-dynamic";

const statuses = [
  ["planned", "Planned"],
  ["awaiting_evidence", "Awaiting Evidence"],
  ["eligible", "Eligible"],
  ["awaiting_invoice", "Awaiting Invoice"],
  ["under_verification", "Under Verification"],
  ["certified", "Certified"],
  ["submitted_to_ap", "Submitted to AP"],
  ["paid", "Paid"],
  ["on_hold", "On Hold"],
  ["cancelled", "Cancelled"],
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string; updated?: string; bulk_updated?: string; vendor?: string }>;
}) {
  const q = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle()
    : { data: null as any };
  const isSuperAdmin = Boolean(me?.is_super_admin || user?.email?.toLowerCase() === "sarwar.khalid@miranenergy.com");

  const [mr, vr, pr, cr, projectResult] = await Promise.all([
    supabase
      .from("payment_milestones")
      .select("id,purchase_order_id,milestone_name,percentage,fixed_amount,planned_due_date,payment_due_date,status,is_deleted")
      .eq("is_deleted", false)
      .order("planned_due_date"),
    supabase.from("vendors").select("id,vendor_name").eq("is_active", true).order("vendor_name"),
    supabase.from("purchase_orders").select("id,po_number,current_value,currency_id,vendor_id,project_id").eq("is_deleted", false),
    supabase.from("currencies").select("id,code"),
    supabase.from("projects").select("id,project_name,project_code").eq("is_deleted", false),
  ]);

  const allRows = mr.data ?? [];
  const referencedPoIds = new Set(allRows.map((r:any)=>String(r.purchase_order_id||"")));
  const activePos=(pr.data??[]).filter((p:any)=>referencedPoIds.has(String(p.id)));
  const pos = new Map<string, any>(activePos.map((p: any) => [String(p.id), p]));
  const selectedVendorId = q.vendor || "";
  const rows = selectedVendorId
    ? allRows.filter((m: any) => String(pos.get(String(m.purchase_order_id))?.vendor_id || "") === selectedVendorId)
    : allRows;

  const currencies = new Map<string, string>((cr.data ?? []).map((c: any) => [String(c.id), String(c.code ?? "")]));
  const projects = new Map<string,string>((projectResult.data??[]).map((x:any)=>[String(x.id),String(x.project_name||x.project_code||"Unnamed Package")]));
  const vendors = (vr.data ?? []).map((v: any) => ({ id: String(v.id), vendor_name: String(v.vendor_name || "") }));
  const vendorMap = new Map<string,string>(vendors.map(v=>[v.id,v.vendor_name]));
  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  const summaryMap = new Map<string, { po_number: string; package_name:string; allocated: number; remaining: number; remainingAmount: number }>();
  for (const m of rows) {
    const p = pos.get(String((m as any).purchase_order_id));
    if (!p) continue;
    const k = String(p.id);
    const cur = summaryMap.get(k) || { po_number: p.po_number, package_name:projects.get(String(p.project_id))||"—", allocated: 0, remaining: 100, remainingAmount: Number(p.current_value || 0) };
    const pct = (m as any).percentage != null
      ? Number((m as any).percentage)
      : Number(p.current_value || 0)
        ? Number((m as any).fixed_amount || 0) / Number(p.current_value || 0) * 100
        : 0;
    cur.allocated += pct;
    cur.remaining = Math.max(0, 100 - cur.allocated);
    cur.remainingAmount = Math.max(0, Number(p.current_value || 0) * (cur.remaining / 100));
    summaryMap.set(k, cur);
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      {q.deleted ? <Notice kind="success">Milestone deleted. PO allocation has been recalculated from active milestones.</Notice> : null}
      {q.updated ? <Notice kind="success">Milestone updated successfully.</Notice> : null}
      {q.bulk_updated ? <Notice kind="success">All selected supplier milestones were updated successfully.</Notice> : null}
      {q.error ? <Notice kind="error">{q.error}</Notice> : null}

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">MCCS</div>
          <h1 className="mt-2 text-3xl font-bold">Payment Milestones</h1>
          <p className="mt-2 text-sm text-slate-500">Contractual payment obligations, allocation and remaining PO exposure.</p>
        </div>
        <MilestoneVendorFilter vendors={vendors} selectedVendorId={selectedVendorId} />
      </div>

      {selectedVendor ? (
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          Showing payment milestones for <strong>{selectedVendor.vendor_name}</strong>. {rows.length} active milestone{rows.length === 1 ? "" : "s"} found.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[...summaryMap.entries()].slice(0, 9).map(([id, s]) => {
          const p = pos.get(id);
          return (
            <div key={id} className="mccs-card rounded-2xl p-5">
              <div className="text-xs font-bold uppercase text-slate-500">{s.po_number}</div>
              <div className="mt-1 text-sm font-semibold text-blue-700">{s.package_name}</div>
              <div className="mt-2 text-2xl font-bold">{s.allocated.toFixed(2)}% allocated</div>
              <div className="mt-2 text-sm text-slate-500">Remaining: {s.remaining.toFixed(2)}% • {currencies.get(p?.currency_id) || ""} {s.remainingAmount.toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      {isSuperAdmin && selectedVendor ? (
        <form action={bulkUpdateMilestones} className="mccs-card mt-6 overflow-hidden rounded-2xl border border-blue-100">
          <input type="hidden" name="vendor_id" value={selectedVendorId} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50/70 px-5 py-4 dark:bg-blue-950/20">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">Super Admin Bulk Editor</div>
              <h2 className="mt-1 text-xl font-bold">Edit all milestones — {selectedVendor.vendor_name}</h2>
              <p className="mt-1 text-sm text-slate-500">Update names, percentages/amounts, due dates and status in one screen, then save once.</p>
            </div>
            <button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 dark:bg-blue-600">
              Save All Milestones
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Supplier / Contractor</th>
                  <th className="px-4 py-3">PO</th>
                  <th className="px-4 py-3 min-w-[220px]">Package</th>
                  <th className="px-4 py-3 min-w-[260px]">Milestone</th>
                  <th className="px-4 py-3 w-[130px]">%</th>
                  <th className="px-4 py-3 w-[160px]">Fixed Amount</th>
                  <th className="px-4 py-3 w-[170px]">Milestone Due</th>
                  <th className="px-4 py-3 w-[170px]">Payment Due</th>
                  <th className="px-4 py-3 w-[210px]">Status</th>
                  <th className="px-4 py-3">Calculated</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {rows.map((m: any) => {
                  const p = pos.get(String(m.purchase_order_id));
                  const amt = m.percentage != null ? Number(p?.current_value || 0) * Number(m.percentage) / 100 : Number(m.fixed_amount || 0);
                  return (
                    <tr key={m.id} className="align-top">
                      <td className="px-4 py-3 font-semibold">{vendorMap.get(String(p?.vendor_id)) || "—"}</td>
                      <td className="px-4 py-3 font-bold">{p?.po_number || "—"}<input type="hidden" name="milestone_id" value={m.id} /></td>
                      <td className="px-4 py-3 font-semibold">{projects.get(String(p?.project_id))||"—"}</td>
                      <td className="px-4 py-3"><input className="input min-w-[240px]" name={`milestone_name_${m.id}`} defaultValue={m.milestone_name || ""} required /></td>
                      <td className="px-4 py-3"><input className="input" name={`percentage_${m.id}`} type="number" min="0" max="100" step="0.01" defaultValue={m.percentage ?? ""} /></td>
                      <td className="px-4 py-3"><input className="input" name={`fixed_amount_${m.id}`} type="number" min="0" step="0.01" defaultValue={m.percentage == null ? (m.fixed_amount ?? "") : ""} placeholder="If % blank" /></td>
                      <td className="px-4 py-3"><input className="input" name={`planned_due_date_${m.id}`} type="date" defaultValue={m.planned_due_date || ""} /></td>
                      <td className="px-4 py-3"><input className="input" name={`payment_due_date_${m.id}`} type="date" defaultValue={m.payment_due_date || ""} /></td>
                      <td className="px-4 py-3"><select className="input" name={`status_${m.id}`} defaultValue={m.status || "planned"}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                      <td className="px-4 py-4 font-semibold whitespace-nowrap">{currencies.get(p?.currency_id) || ""} {amt.toLocaleString()}</td>
                    </tr>
                  );
                })}
                {!rows.length ? <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-500">No active milestones for this supplier.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t bg-slate-50 px-5 py-4 dark:bg-slate-900/60">
            <button className="rounded-xl bg-[#07111f] px-6 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 dark:bg-blue-600">Save All Milestones</button>
          </div>
        </form>
      ) : isSuperAdmin ? (
        <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-white p-6 text-center dark:bg-slate-950">
          <div className="text-base font-bold">Bulk milestone editing is ready</div>
          <div className="mt-1 text-sm text-slate-500">Select a Supplier / Contractor above to edit all of its payment milestones together.</div>
        </div>
      ) : null}

      <div className="mccs-card mt-6 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr><th className="px-5 py-3">Supplier / Contractor</th><th className="px-5 py-3">PO</th><th className="px-5 py-3">Package</th><th className="px-5 py-3">Milestone</th><th className="px-5 py-3">%</th><th className="px-5 py-3">Calculated Amount</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Payment Due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {rows.map((m: any) => {
                const p = pos.get(String(m.purchase_order_id));
                const amt = m.percentage != null ? Number(p?.current_value || 0) * Number(m.percentage) / 100 : Number(m.fixed_amount || 0);
                return (
                  <tr key={m.id}>
                    <td className="px-5 py-4 font-semibold">{vendorMap.get(String(p?.vendor_id)) || "—"}</td>
                    <td className="px-5 py-4 font-bold">{p?.po_number || "—"}</td>
                    <td className="px-5 py-4 font-semibold">{projects.get(String(p?.project_id))||"—"}</td>
                    <td className="px-5 py-4">{m.milestone_name}</td>
                    <td className="px-5 py-4 font-semibold">{m.percentage != null ? `${Number(m.percentage).toFixed(2)}%` : "—"}</td>
                    <td className="px-5 py-4">{currencies.get(p?.currency_id) || ""} {amt.toLocaleString()}</td>
                    <td className="px-5 py-4">{m.planned_due_date || "—"}</td>
                    <td className="px-5 py-4">{m.payment_due_date || "—"}</td>
                    <td className="px-5 py-4 capitalize">{m.status}</td>
                    <td className="px-5 py-4"><div className="flex gap-3"><Link href={`/payment-milestones/${m.id}/edit`} className="font-bold text-blue-700">Edit</Link>{isSuperAdmin ? <SuperAdminDelete entity="milestone" entityId={m.id} entityLabel={m.milestone_name} idField="milestone_id" action={deletePaymentMilestone} /> : null}</div></td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan={10} className="px-5 py-12 text-center text-slate-500">No payment milestones yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Notice({ kind, children }: { kind: "success" | "error"; children: React.ReactNode }) {
  const cls = kind === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-700";
  return <div className={`mb-5 rounded-xl border p-4 text-sm ${cls}`}>{children}</div>;
}
