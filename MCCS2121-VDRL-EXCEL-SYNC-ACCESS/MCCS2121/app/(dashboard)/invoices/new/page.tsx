import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoiceCreateForm } from "@/components/commercial-linked-forms";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;

  const [pr, vr, cr, mr, pf, ur, rr] = await Promise.all([
    s.from("purchase_orders").select("id,po_number,vendor_id,currency_id,current_value").eq("is_deleted", false).order("po_number"),
    s.from("vendors").select("id,vendor_name").eq("is_active", true).order("vendor_name"),
    s.from("currencies").select("id,code").eq("is_active", true).order("code"),
    s.from("payment_milestones").select("id,purchase_order_id,milestone_name,percentage,fixed_amount,planned_due_date,payment_due_date,status").eq("is_deleted", false).order("sequence_no"),
    s.from("profiles").select("id,full_name,preferred_name,is_active").eq("is_active", true),
    s.from("user_roles").select("user_id,role_id"),
    s.from("roles").select("id,role_code"),
  ]);

  const vendorMap = new Map<string, string>((vr.data ?? []).map((v: any) => [String(v.id), String(v.vendor_name)]));
  const currencyMap = new Map<string, string>((cr.data ?? []).map((c: any) => [String(c.id), String(c.code)]));
  const poValueMap = new Map<string, number>((pr.data ?? []).map((p: any) => [String(p.id), Number(p.current_value || 0)]));

  const pos = (pr.data ?? []).map((p: any) => ({
    id: String(p.id),
    po_number: String(p.po_number),
    vendor_id: p.vendor_id ? String(p.vendor_id) : null,
    vendor_name: vendorMap.get(String(p.vendor_id)) || "Unknown Supplier",
    currency_id: p.currency_id ? String(p.currency_id) : null,
    currency_code: currencyMap.get(String(p.currency_id)) || "",
    current_value: Number(p.current_value || 0),
  }));

  const milestones = (mr.data ?? []).map((m: any) => {
    const poValue = poValueMap.get(String(m.purchase_order_id)) || 0;
    const calculated = m.fixed_amount != null ? Number(m.fixed_amount) : m.percentage != null ? poValue * Number(m.percentage) / 100 : 0;
    return {
      id: String(m.id),
      purchase_order_id: String(m.purchase_order_id),
      milestone_name: String(m.milestone_name),
      percentage: m.percentage == null ? null : Number(m.percentage),
      fixed_amount: m.fixed_amount == null ? null : Number(m.fixed_amount),
      calculated_amount: calculated,
      planned_due_date: m.planned_due_date,
      payment_due_date: m.payment_due_date,
      status: m.status,
    };
  });

  const allowed = new Set((rr.data ?? []).filter((r: any) => ["discipline_engineer", "project_manager", "commercial", "admin", "super_admin"].includes(String(r.role_code))).map((r: any) => String(r.id)));
  const reviewerIds = new Set((ur.data ?? []).filter((x: any) => allowed.has(String(x.role_id))).map((x: any) => String(x.user_id)));
  const reviewers = (pf.data ?? []).filter((p: any) => reviewerIds.has(String(p.id))).map((p: any) => ({ id: String(p.id), label: String(p.preferred_name || p.full_name || "Reviewer") }));

  return <div className="mx-auto max-w-5xl">
    <div className="flex justify-between">
      <div><div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Invoice Assurance</div><h1 className="mt-2 text-3xl font-bold">New Invoice</h1><p className="mt-2 text-sm text-slate-500">Register invoice and optionally assign the technical reviewer immediately.</p></div>
      <Link href="/invoices" className="font-bold text-blue-700">Back</Link>
    </div>
    {q.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{q.error}</div> : null}
    <InvoiceCreateForm pos={pos} vendors={(vr.data ?? []).map((v: any) => ({ id: String(v.id), vendor_name: String(v.vendor_name) }))} currencies={(cr.data ?? []).map((c: any) => ({ id: String(c.id), code: String(c.code) }))} milestones={milestones} reviewers={reviewers} />
  </div>;
}
