import Link from "next/link";
import { createDocumentMetadata } from "../../_actions/commercial";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;
  const [projects, pos, invoices, vendors, milestones] = await Promise.all([
    s.from("projects").select("id,project_code,project_name").eq("is_active", true).order("project_name"),
    s.from("purchase_orders").select("id,po_number").eq("is_deleted", false).order("po_number"),
    s.from("invoices").select("id,invoice_number").eq("is_deleted", false).order("invoice_number"),
    s.from("vendors").select("id,vendor_name").eq("is_active", true).order("vendor_name"),
    s.from("payment_milestones").select("id,milestone_name").order("milestone_name"),
  ]);

  return <div className="mx-auto max-w-4xl">
    <div className="flex justify-between gap-4"><div><h1 className="text-3xl font-bold">Add Document Record</h1><p className="mt-2 text-sm text-slate-500">Register historical/current document metadata without uploading a file.</p></div><Link href="/documents" className="font-bold text-blue-700">Back</Link></div>
    {q.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{q.error}</div> : null}
    <form action={createDocumentMetadata} className="mccs-card mt-7 rounded-2xl p-6"><div className="grid gap-5 md:grid-cols-2">
      <F l="Document Title *"><input name="document_title" required className="input" placeholder="e.g. Purchase Order, Vendor Invoice" /></F>
      <F l="Document Type *"><input name="document_type" required className="input" placeholder="PO / Invoice / Contract / Approval" /></F>
      <F l="File Name / Reference *"><input name="file_name" required className="input" /></F>
      <F l="Revision"><input name="revision" className="input" /></F>
      <F l="Project"><select name="project_id" className="input"><option value="">Not linked</option>{(projects.data ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.project_code} — {x.project_name}</option>)}</select></F>
      <F l="Contractor / Vendor"><select name="vendor_id" className="input"><option value="">Not linked</option>{(vendors.data ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.vendor_name}</option>)}</select></F>
      <F l="Purchase Order"><select name="purchase_order_id" className="input"><option value="">Not linked</option>{(pos.data ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.po_number}</option>)}</select></F>
      <F l="Invoice"><select name="invoice_id" className="input"><option value="">Not linked</option>{(invoices.data ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.invoice_number}</option>)}</select></F>
      <F l="Payment Milestone"><select name="milestone_id" className="input"><option value="">Not linked</option>{(milestones.data ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.milestone_name}</option>)}</select></F>
    </div>
    <label className="mt-5 flex items-center gap-3"><input type="checkbox" name="is_historical" /> Historical document</label>
    <div className="mt-7 flex justify-end"><button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white dark:bg-blue-600">Save Document Record</button></div></form>
  </div>;
}
function F({l,children}:{l:string;children:React.ReactNode}){return <label><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{l}</span>{children}</label>}
