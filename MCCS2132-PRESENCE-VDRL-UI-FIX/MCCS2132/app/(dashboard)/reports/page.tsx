import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ReportDetail = "pos" | "invoices" | "payments" | "overdue" | "remaining";

function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ detail?: string }>;
}) {
  const q = await searchParams;
  const detail = (["pos", "invoices", "payments", "overdue", "remaining"].includes(String(q.detail))
    ? String(q.detail)
    : "") as ReportDetail | "";

  const s = await createClient();
  if (!s) return null;

  const [pr, ir, pyr, mr, cr, vr] = await Promise.all([
    s.from("purchase_orders").select("id,po_number,vendor_id,po_date,current_value,currency_id,status,is_deleted").order("po_date", { ascending: false }),
    s.from("invoices").select("id,invoice_number,purchase_order_id,vendor_id,invoice_amount,certified_amount,currency_id,status,due_date,is_deleted").eq("is_deleted", false).order("due_date", { ascending: true }),
    s.from("payments").select("id,purchase_order_id,invoice_id,paid_amount,currency_id,payment_date,payment_reference,bank_reference,is_deleted").eq("is_deleted", false).order("payment_date", { ascending: false }),
    s.from("payment_milestones").select("status,payment_due_date,is_deleted").eq("is_deleted", false),
    s.from("currencies").select("id,code"),
    s.from("vendors").select("id,vendor_name"),
  ]);

  const cm = new Map<string, string>((cr.data ?? []).map((x: any) => [String(x.id), String(x.code)]));
  const vm = new Map<string, string>((vr.data ?? []).map((x: any) => [String(x.id), String(x.vendor_name)]));
  const poMap = new Map<string, string>((pr.data ?? []).map((x: any) => [String(x.id), String(x.po_number)]));
  const invMap = new Map<string, string>((ir.data ?? []).map((x: any) => [String(x.id), String(x.invoice_number)]));
  const paidByPo = new Map<string, number>();
  for (const x of (pyr.data ?? [])) paidByPo.set(String(x.purchase_order_id), (paidByPo.get(String(x.purchase_order_id)) || 0) + Number(x.paid_amount || 0));

  function totals(rows: any[], field: string) {
    const m = new Map<string, number>();
    for (const x of rows) {
      const c = cm.get(String(x.currency_id)) || "N/A";
      m.set(c, (m.get(c) || 0) + Number(x[field] || 0));
    }
    return [...m].sort();
  }

  const pos = (pr.data ?? []).filter((x: any) => !x.is_deleted);
  const inv = ir.data ?? [];
  const pay = pyr.data ?? [];
  const now = new Date();
  const overdueRows = inv.filter((x: any) => x.due_date && new Date(x.due_date) < now && !["paid", "submitted_to_ap"].includes(String(x.status).toLowerCase()));

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Commercial Intelligence</div>
          <h1 className="mt-2 text-3xl font-bold">Reports</h1>
          <p className="mt-2 text-sm text-slate-500">Live multi-currency commercial position, invoice aging and milestone pipeline.</p>
        </div>
        <a href="/api/export/commercial" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold dark:bg-slate-900">Export Excel</a>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <K l="Active POs" v={String(pos.length)} href="/reports?detail=pos" active={detail === "pos"} />
        <K l="Invoices" v={String(inv.length)} href="/reports?detail=invoices" active={detail === "invoices"} />
        <K l="Payments" v={String(pay.length)} href="/reports?detail=payments" active={detail === "payments"} />
        <K l="Overdue Invoices" v={String(overdueRows.length)} href="/reports?detail=overdue" active={detail === "overdue"} danger={overdueRows.length > 0} />
      </div>

      {detail ? (
        <div className="mccs-card mt-5 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold">{detailTitle(detail)}</h2>
              <p className="mt-1 text-xs text-slate-500">Live records behind the selected KPI.</p>
            </div>
            <Link href="/reports" className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300">Close list</Link>
          </div>
          <div className="overflow-x-auto">
            {detail === "remaining" ? (
              <table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">PO</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Committed</th><th className="px-5 py-3">Paid</th><th className="px-5 py-3">Remaining</th><th className="px-5 py-3">Open</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{pos.map((x:any)=>{const committed=Number(x.current_value||0),paid=paidByPo.get(String(x.id))||0,remaining=Math.max(committed-paid,0),cur=cm.get(String(x.currency_id))||"";return <tr key={x.id}><td className="px-5 py-4 font-bold">{x.po_number}</td><td className="px-5 py-4">{vm.get(String(x.vendor_id))||"—"}</td><td className="px-5 py-4">{cur} {committed.toLocaleString()}</td><td className="px-5 py-4 text-emerald-700">{cur} {paid.toLocaleString()}</td><td className="px-5 py-4 font-bold text-blue-700">{cur} {remaining.toLocaleString()}</td><td className="px-5 py-4"><Link className="font-bold text-blue-700 hover:underline" href={`/purchase-orders/${x.id}`}>Open</Link></td></tr>})}</tbody></table>
            ) : detail === "pos" ? (
              <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">PO</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">PO Date</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Open</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{pos.map((x:any)=><tr key={x.id}><td className="px-5 py-4 font-bold">{x.po_number}</td><td className="px-5 py-4">{vm.get(String(x.vendor_id)) || "—"}</td><td className="px-5 py-4">{fmtDate(x.po_date)}</td><td className="px-5 py-4 font-semibold">{cm.get(String(x.currency_id)) || ""} {Number(x.current_value || 0).toLocaleString()}</td><td className="px-5 py-4">{x.status || "—"}</td><td className="px-5 py-4"><Link className="font-bold text-blue-700 hover:underline" href={`/purchase-orders/${x.id}`}>Open</Link></td></tr>)}{!pos.length?<tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No active PO records.</td></tr>:null}</tbody></table>
            ) : detail === "payments" ? (
              <table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">Payment Date</th><th className="px-5 py-3">PO</th><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Payment Ref</th><th className="px-5 py-3">Bank Ref</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{pay.map((x:any)=><tr key={x.id}><td className="px-5 py-4 font-semibold">{fmtDate(x.payment_date)}</td><td className="px-5 py-4">{poMap.get(String(x.purchase_order_id)) || "—"}</td><td className="px-5 py-4">{invMap.get(String(x.invoice_id)) || "—"}</td><td className="px-5 py-4 font-bold text-emerald-700">{cm.get(String(x.currency_id)) || ""} {Number(x.paid_amount || 0).toLocaleString()}</td><td className="px-5 py-4">{x.payment_reference || "—"}</td><td className="px-5 py-4">{x.bank_reference || "—"}</td></tr>)}{!pay.length?<tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No payment records.</td></tr>:null}</tbody></table>
            ) : (
              <table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">PO</th><th className="px-5 py-3">Invoice Value</th><th className="px-5 py-3">Certified</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Open</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{(detail === "overdue" ? overdueRows : inv).map((x:any)=><tr key={x.id}><td className="px-5 py-4 font-bold">{x.invoice_number}</td><td className="px-5 py-4">{vm.get(String(x.vendor_id)) || "—"}</td><td className="px-5 py-4">{poMap.get(String(x.purchase_order_id)) || "—"}</td><td className="px-5 py-4">{cm.get(String(x.currency_id)) || ""} {Number(x.invoice_amount || 0).toLocaleString()}</td><td className="px-5 py-4">{cm.get(String(x.currency_id)) || ""} {Number(x.certified_amount || 0).toLocaleString()}</td><td className={`px-5 py-4 ${detail === "overdue" ? "font-bold text-red-700" : ""}`}>{fmtDate(x.due_date)}</td><td className="px-5 py-4">{x.status || "—"}</td><td className="px-5 py-4"><Link className="font-bold text-blue-700 hover:underline" href={`/invoices/${x.id}`}>Open</Link></td></tr>)}{!(detail === "overdue" ? overdueRows : inv).length?<tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">No records for this KPI.</td></tr>:null}</tbody></table>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Summary title="Committed by Currency" rows={totals(pos, "current_value")} />
        <Summary title="Certified by Currency" rows={totals(inv, "certified_amount")} />
        <Summary title="Paid by Currency" rows={totals(pay, "paid_amount")} />
      </div>

      <div className="mccs-card mt-6 rounded-2xl p-6">
        <h2 className="text-lg font-bold">Milestone Pipeline</h2>
        <div className="mt-4 flex flex-wrap gap-3">{[...new Map<string, number>((mr.data ?? []).map((x:any)=>[String(x.status),0])).keys()].map(st=>{const n=(mr.data??[]).filter((x:any)=>String(x.status)===st).length;return <div key={st} className="rounded-xl border px-4 py-3"><div className="text-xs uppercase text-slate-500">{st.replaceAll("_"," ")}</div><div className="mt-1 text-2xl font-bold">{n}</div></div>})}</div>
      </div>
    </div>
  );
}

function detailTitle(detail: ReportDetail) {
  if (detail === "pos") return "Active Purchase Orders";
  if (detail === "payments") return "Payment Register";
  if (detail === "overdue") return "Overdue Invoice Register";
  if (detail === "remaining") return "Remaining Commitment by Purchase Order";
  return "Invoice Register";
}

function K({ l, v, href, active, danger = false }: { l: string; v: string; href: string; active: boolean; danger?: boolean }) {
  return <Link href={href} className={`mccs-card group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${active ? "border-blue-400 ring-2 ring-blue-100" : "border-transparent"}`}><div className="flex items-start justify-between"><div><div className="text-xs font-bold uppercase text-slate-500">{l}</div><div className={`mt-2 text-3xl font-bold ${danger ? "text-red-700" : ""}`}>{v}</div></div><span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-700 opacity-0 transition group-hover:opacity-100">View list</span></div></Link>;
}

function Summary({ title, rows }: { title: string; rows: [string, number][] }) {
  return <div className="mccs-card rounded-2xl p-6"><h2 className="font-bold">{title}</h2><div className="mt-4 space-y-3">{rows.map(([c,v])=><div key={c} className="flex justify-between border-b border-slate-100 pb-2"><span className="font-bold text-blue-700">{c}</span><span>{v.toLocaleString()}</span></div>)}{!rows.length?<div className="text-sm text-slate-500">No data</div>:null}</div></div>;
}
