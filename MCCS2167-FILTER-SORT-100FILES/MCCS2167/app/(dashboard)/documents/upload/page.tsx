import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoogleDriveUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ po?: string; invoice?: string }> }) {
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;

  const [pr, por, ir, vr, mr] = await Promise.all([
    s.from("projects").select("id,project_code,project_name,vendor_id").eq("is_active", true).order("project_name"),
    s.from("purchase_orders").select("id,po_number,project_id,vendor_id").eq("is_deleted", false).order("po_number"),
    s.from("invoices").select("id,invoice_number,purchase_order_id,vendor_id").eq("is_deleted", false).order("invoice_number"),
    s.from("vendors").select("id,vendor_name").eq("is_active", true).order("vendor_name"),
    s.from("payment_milestones").select("id,purchase_order_id,milestone_name,sequence_no").eq("is_deleted", false).order("sequence_no"),
  ]);

  const poMap = new Map<string, any>((por.data ?? []).map((x: any) => [String(x.id), x] as [string, any]));
  const invoices = (ir.data ?? []).map((x: any) => { const po = x.purchase_order_id ? poMap.get(String(x.purchase_order_id)) : null; return { ...x, po_number: po?.po_number || "", project_id: po?.project_id || "", vendor_id: x.vendor_id || po?.vendor_id || "" }; });

  return <div className="mx-auto max-w-5xl">
    <div className="flex items-end justify-between gap-4"><div><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Google Drive Storage</div><h1 className="mt-2 text-3xl font-bold">Upload Commercial Document</h1><p className="mt-2 text-sm text-slate-500">Store commercial documents using the Vendor → Project/Package → PO / Invoice / SRF / Other Documents structure.</p></div><Link href="/documents" className="font-bold text-blue-700">Back</Link></div>
    {!(pr.data ?? []).length ? <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><div className="font-bold">No Project / Supply Package has been created yet.</div><div className="mt-1">Create the package under the correct Vendor / Contractor first, then return here to upload documents.</div><Link href="/projects/new" className="mt-3 inline-flex rounded-xl bg-[#07111f] px-4 py-2.5 font-bold text-white">Create Project / Package</Link></div> : null}
    <GoogleDriveUploadForm projects={pr.data ?? []} purchaseOrders={por.data ?? []} invoices={invoices} vendors={vr.data ?? []} milestones={mr.data ?? []} initialPoId={q.po || ""} initialInvoiceId={q.invoice || ""} />
  </div>;
}
