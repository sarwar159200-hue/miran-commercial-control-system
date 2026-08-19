import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  purchase_order_id: string | null;
  vendor_id: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number | string | null;
  certified_amount: number | string | null;
  status: string | null;
  due_date: string | null;
  currency_id: string | null;
};

export default async function Page() {
  const supabase = await createClient();
  if (!supabase) return null;

  const invoiceResult = await supabase
    .from("invoices")
    .select("id,purchase_order_id,vendor_id,invoice_number,invoice_date,invoice_amount,certified_amount,status,due_date,currency_id")
    .order("invoice_date", { ascending: false });

  const rows = (invoiceResult.data ?? []) as InvoiceRow[];
  const poIds = [...new Set(rows.map(r => r.purchase_order_id).filter((id): id is string => Boolean(id)))];
  const vendorIds = [...new Set(rows.map(r => r.vendor_id).filter((id): id is string => Boolean(id)))];
  const currencyIds = [...new Set(rows.map(r => r.currency_id).filter((id): id is string => Boolean(id)))];

  const [poResult, vendorResult, currencyResult] = await Promise.all([
    poIds.length ? supabase.from("purchase_orders").select("id,po_number").in("id", poIds) : Promise.resolve({ data: [] }),
    vendorIds.length ? supabase.from("vendors").select("id,vendor_name").in("id", vendorIds) : Promise.resolve({ data: [] }),
    currencyIds.length ? supabase.from("currencies").select("id,code").in("id", currencyIds) : Promise.resolve({ data: [] }),
  ]);

  const poMap = new Map<string, string>((poResult.data ?? []).map((r: any) => [String(r.id), String(r.po_number ?? "—")]));
  const vendorMap = new Map<string, string>((vendorResult.data ?? []).map((r: any) => [String(r.id), String(r.vendor_name ?? "—")]));
  const currencyMap = new Map<string, string>((currencyResult.data ?? []).map((r: any) => [String(r.id), String(r.code ?? "")]));

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Invoice Assurance</div>
          <h1 className="mt-2 text-3xl font-bold">Invoices</h1>
          <p className="mt-2 text-sm text-slate-500">Invoice validation, certification and Accounts Payable routing.</p>
        </div>
        <Link href="/invoices/new" className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white">New Invoice</Link>
      </div>

      {invoiceResult.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Invoices could not be loaded: {invoiceResult.error.message}</div> : null}

      <div className="mccs-card mt-7 overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">PO</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Invoice Value</th><th className="px-5 py-3">Certified</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Status</th></tr></thead>
          <tbody className="divide-y">
            {rows.map(row => {
              const poNumber = row.purchase_order_id ? poMap.get(row.purchase_order_id) ?? "—" : "—";
              const vendorName = row.vendor_id ? vendorMap.get(row.vendor_id) ?? "—" : "—";
              const currency = row.currency_id ? currencyMap.get(row.currency_id) ?? "" : "";
              return <tr key={row.id}><td className="px-5 py-4 font-bold">{row.invoice_number}</td><td className="px-5 py-4">{poNumber}</td><td className="px-5 py-4">{vendorName}</td><td className="px-5 py-4">{currency} {Number(row.invoice_amount ?? 0).toLocaleString()}</td><td className="px-5 py-4">{currency} {Number(row.certified_amount ?? 0).toLocaleString()}</td><td className="px-5 py-4">{row.due_date ?? "—"}</td><td className="px-5 py-4 capitalize">{String(row.status ?? "received").replaceAll("_", " ")}</td></tr>;
            })}
            {!rows.length ? <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No invoices yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
