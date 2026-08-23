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
    s.from("payment_milestones").select("id,milestone_name").order("milestone_name"),
  ]);

  const poMap = new Map((por.data ?? []).map((x: any) => [String(x.id), x]));
  const invoices = (ir.data ?? []).map((x: any) => { const po = x.purchase_order_id ? poMap.get(String(x.purchase_order_id)) : null; return { ...x, po_number: po?.po_number || "", project_id: po?.project_id || "", vendor_id: x.vendor_id || po?.vendor_id || "" }; });

  return <div className="mx-auto max-w-5xl">
    <div className="flex items-end justify-between gap-4"><div><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Google Drive Storage</div><h1 className="mt-2 text-3xl font-bold">Upload Commercial Document</h1><p className="mt-2 text-sm text-slate-500">Store commercial documents using the Vendor → Project/Package → PO / Invoice / SRF / Other Documents structure.</p></div><Link href="/documents" className="font-bold text-blue-700">Back</Link></div>
    <GoogleDriveUploadForm projects={pr.data ?? []} purchaseOrders={por.data ?? []} invoices={invoices} vendors={vr.data ?? []} milestones={mr.data ?? []} initialPoId={q.po || ""} initialInvoiceId={q.invoice || ""} />
  </div>;
}
