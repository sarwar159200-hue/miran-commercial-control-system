import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ uploaded?: string }> }) {
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;

  const r = await s.from("documents").select("id,document_title,document_type,file_name,revision,purchase_order_id,invoice_id,vendor_id,google_drive_web_url,onedrive_web_url,is_historical,uploaded_at,storage_provider,storage_status,file_size").order("uploaded_at", { ascending: false });
  const rows = r.data ?? [];
  const poIds = [...new Set(rows.map((x: any) => x.purchase_order_id).filter(Boolean))];
  const invoiceIds = [...new Set(rows.map((x: any) => x.invoice_id).filter(Boolean))];
  const vendorIds = [...new Set(rows.map((x: any) => x.vendor_id).filter(Boolean))];
  const [por, ir, vr] = await Promise.all([
    poIds.length ? s.from("purchase_orders").select("id,po_number").in("id", poIds) : Promise.resolve({ data: [] } as any),
    invoiceIds.length ? s.from("invoices").select("id,invoice_number").in("id", invoiceIds) : Promise.resolve({ data: [] } as any),
    vendorIds.length ? s.from("vendors").select("id,vendor_name").in("id", vendorIds) : Promise.resolve({ data: [] } as any),
  ]);
  const poMap = new Map((por.data ?? []).map((x: any) => [String(x.id), x.po_number]));
  const invoiceMap = new Map((ir.data ?? []).map((x: any) => [String(x.id), x.invoice_number]));
  const vendorMap = new Map((vr.data ?? []).map((x: any) => [String(x.id), x.vendor_name]));

  return <div className="mx-auto max-w-[1600px]">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">MCCS</div><h1 className="mt-2 text-3xl font-bold">Documents</h1><p className="mt-2 text-sm text-slate-500">Commercial document register with Google Drive-backed file storage.</p></div><div className="flex gap-2"><Link href="/documents/new" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900">Metadata Only</Link><Link href="/documents/upload" className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white dark:bg-blue-600">Attach Document</Link></div></div>
    {q.uploaded ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">File uploaded to Google Drive and registered successfully.</div> : null}
    {r.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{r.error.message}</div> : null}
    <div className="mccs-card mt-7 overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contractor</th><th className="px-4 py-3">PO</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Rev</th><th className="px-4 py-3">Storage</th><th className="px-4 py-3">Historical</th></tr></thead><tbody className="divide-y dark:divide-slate-800">
      {rows.map((x: any) => { const url = x.google_drive_web_url || x.onedrive_web_url || ""; return <tr key={x.id}><td className="px-4 py-4 font-bold">{x.document_title || x.file_name}</td><td className="px-4 py-4">{x.document_type}</td><td className="px-4 py-4">{x.vendor_id ? vendorMap.get(String(x.vendor_id)) || "—" : "—"}</td><td className="px-4 py-4">{x.purchase_order_id ? poMap.get(String(x.purchase_order_id)) || "—" : "—"}</td><td className="px-4 py-4">{x.invoice_id ? invoiceMap.get(String(x.invoice_id)) || "—" : "—"}</td><td className="px-4 py-4">{url ? <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:underline">{x.file_name}</a> : x.file_name}</td><td className="px-4 py-4">{x.revision || "—"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${x.storage_provider === "google_drive" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{x.storage_provider === "google_drive" ? "Google Drive" : x.storage_provider || "Metadata"}</span></td><td className="px-4 py-4">{x.is_historical ? "Yes" : "No"}</td></tr> })}
      {!rows.length ? <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-500">No commercial document records yet.</td></tr> : null}
    </tbody></table></div></div>
  </div>;
}
