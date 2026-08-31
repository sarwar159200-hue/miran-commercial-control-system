import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PaymentForm } from "@/components/commercial-linked-forms";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;

  const [pr, ir, cr, vr, mr, pyr, pjr] = await Promise.all([
    s.from("purchase_orders").select("id,po_number,vendor_id,currency_id,current_value,project_id").eq("is_deleted", false).order("po_number"),
    s.from("invoices").select("id,invoice_number,purchase_order_id,vendor_id,currency_id,invoice_amount,certified_amount").eq("is_deleted", false).order("invoice_number"),
    s.from("currencies").select("id,code").eq("is_active", true).order("code"),
    s.from("vendors").select("id,vendor_name").eq("is_active", true).order("vendor_name"),
    s.from("payment_milestones").select("id,purchase_order_id,milestone_name,percentage,fixed_amount,planned_due_date,payment_due_date,status").eq("is_deleted", false).order("sequence_no"),
    s.from("payments").select("id,payment_milestone_id,paid_amount,is_deleted").eq("is_deleted", false),
    s.from("projects").select("id,project_name,project_code").eq("is_deleted", false),
  ]);

  const vendorMap = new Map<string, string>((vr.data ?? []).map((v: any) => [String(v.id), String(v.vendor_name)]));
  const projectMap = new Map<string, string>((pjr.data ?? []).map((p: any) => [String(p.id), String(p.project_name || p.project_code || "Unnamed Package")]));
  const poValueMap = new Map<string, number>((pr.data ?? []).map((p: any) => [String(p.id), Number(p.current_value || 0)]));
  const paidByMilestone = new Map<string, number>();
  for (const p of pyr.data ?? []) if (p.payment_milestone_id) paidByMilestone.set(String(p.payment_milestone_id), (paidByMilestone.get(String(p.payment_milestone_id)) || 0) + Number(p.paid_amount || 0));

  const pos = (pr.data ?? []).map((p: any) => ({
    id: String(p.id), po_number: String(p.po_number), vendor_id: p.vendor_id ? String(p.vendor_id) : null,
    vendor_name: vendorMap.get(String(p.vendor_id)) || "Unknown Supplier", currency_id: p.currency_id ? String(p.currency_id) : null,
    current_value: Number(p.current_value || 0), project_id: p.project_id ? String(p.project_id) : null,
    package_name: p.project_id ? (projectMap.get(String(p.project_id)) || "Unassigned Package") : "No linked package",
  }));

  const invoices = (ir.data ?? []).map((i: any) => ({
    id: String(i.id), invoice_number: String(i.invoice_number), purchase_order_id: String(i.purchase_order_id), vendor_id: i.vendor_id ? String(i.vendor_id) : null,
    vendor_name: vendorMap.get(String(i.vendor_id)) || "Unknown Supplier", currency_id: i.currency_id ? String(i.currency_id) : null,
    invoice_amount: Number(i.invoice_amount || 0), certified_amount: Number(i.certified_amount || 0),
  }));

  const milestones = (mr.data ?? []).map((m: any) => {
    const poValue = poValueMap.get(String(m.purchase_order_id)) || 0;
    const calculated = m.fixed_amount != null ? Number(m.fixed_amount) : m.percentage != null ? poValue * Number(m.percentage) / 100 : 0;
    const alreadyPaid = paidByMilestone.get(String(m.id)) || 0;
    return {
      id: String(m.id), purchase_order_id: String(m.purchase_order_id), milestone_name: String(m.milestone_name), percentage: m.percentage == null ? null : Number(m.percentage),
      fixed_amount: m.fixed_amount == null ? null : Number(m.fixed_amount), calculated_amount: calculated, already_paid: alreadyPaid,
      remaining_amount: Math.max(calculated - alreadyPaid, 0), planned_due_date: m.planned_due_date, payment_due_date: m.payment_due_date, status: m.status,
    };
  });

  return <div className="mx-auto max-w-4xl">
    <div className="flex items-end justify-between"><div><div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Accounts Payable</div><h1 className="mt-2 text-3xl font-bold">Record Payment</h1><p className="mt-2 text-sm text-slate-500">Current or historical actual payment entry.</p></div><Link href="/payments" className="font-bold text-blue-700">Back</Link></div>
    {q.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{q.error}</div> : null}
    <PaymentForm pos={pos} invoices={invoices} currencies={(cr.data ?? []).map((c: any) => ({ id: String(c.id), code: String(c.code) }))} milestones={milestones} />
  </div>;
}
