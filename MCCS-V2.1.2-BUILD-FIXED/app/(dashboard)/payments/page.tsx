import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  invoice_id: string | null;
  purchase_order_id: string | null;
  currency_id: string | null;
  payment_date: string;
  paid_amount: number | string | null;
  payment_reference: string | null;
  bank_reference: string | null;
};

export default async function Page() {
  const supabase = await createClient();
  if (!supabase) return null;

  const paymentResult = await supabase
    .from("payments")
    .select("id,invoice_id,purchase_order_id,currency_id,payment_date,paid_amount,payment_reference,bank_reference")
    .order("payment_date", { ascending: false });

  const rows = (paymentResult.data ?? []) as PaymentRow[];
  const poIds = [...new Set(rows.map(r => r.purchase_order_id).filter((id): id is string => Boolean(id)))];
  const currencyIds = [...new Set(rows.map(r => r.currency_id).filter((id): id is string => Boolean(id)))];

  const [poResult, currencyResult] = await Promise.all([
    poIds.length ? supabase.from("purchase_orders").select("id,po_number").in("id", poIds) : Promise.resolve({ data: [] }),
    currencyIds.length ? supabase.from("currencies").select("id,code").in("id", currencyIds) : Promise.resolve({ data: [] }),
  ]);

  const poMap = new Map<string,string>((poResult.data ?? []).map((r:any) => [String(r.id), String(r.po_number ?? "—")]));
  const currencyMap = new Map<string,string>((currencyResult.data ?? []).map((r:any) => [String(r.id), String(r.code ?? "")]));

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Accounts Payable</div>
          <h1 className="mt-2 text-3xl font-bold">Payments</h1>
          <p className="mt-2 text-sm text-slate-500">Confirmed actual payments and references.</p>
        </div>
        <Link href="/payments/new" className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white">Record Payment</Link>
      </div>
      {paymentResult.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Payments could not be loaded: {paymentResult.error.message}</div> : null}
      <div className="mccs-card mt-7 overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">PO</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Payment Ref</th><th className="px-5 py-3">Bank Ref</th></tr></thead>
          <tbody className="divide-y">
            {rows.map(row => {
              const po = row.purchase_order_id ? poMap.get(row.purchase_order_id) ?? "—" : "—";
              const currency = row.currency_id ? currencyMap.get(row.currency_id) ?? "" : "";
              return <tr key={row.id}><td className="px-5 py-4">{row.payment_date}</td><td className="px-5 py-4 font-bold">{po}</td><td className="px-5 py-4">{currency} {Number(row.paid_amount ?? 0).toLocaleString()}</td><td className="px-5 py-4">{row.payment_reference ?? "—"}</td><td className="px-5 py-4">{row.bank_reference ?? "—"}</td></tr>;
            })}
            {!rows.length ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No payments recorded yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
