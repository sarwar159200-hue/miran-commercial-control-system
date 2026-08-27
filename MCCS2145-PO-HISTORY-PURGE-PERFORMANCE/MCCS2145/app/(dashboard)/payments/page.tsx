import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";
import { deletePayment } from "../_actions/commercial";

export const dynamic = "force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{deleted?:string;error?:string}>}){
  const q=await searchParams;
  const s=await createClient();
  if(!s)return null;

  const {data:{user}}=await s.auth.getUser();
  const {data:me}=user?await s.from("profiles").select("is_super_admin").eq("id",user.id).maybeSingle():{data:null as any};
  const isSuperAdmin=Boolean(me?.is_super_admin||user?.email?.toLowerCase()==="sarwar.khalid@miranenergy.com");

  const r=await s.from("payments")
    .select("id,purchase_order_id,currency_id,payment_date,paid_amount,payment_reference,bank_reference,is_historical,is_deleted")
    .eq("is_deleted",false)
    .order("payment_date",{ascending:false});

  const rows=r.data??[];
  const poIds=[...new Set(rows.map((x:any)=>x.purchase_order_id).filter(Boolean))];
  const cIds=[...new Set(rows.map((x:any)=>x.currency_id).filter(Boolean))];

  const [pr,cr]=await Promise.all([
    poIds.length?s.from("purchase_orders").select("id,po_number,vendor_id").in("id",poIds):Promise.resolve({data:[]} as any),
    cIds.length?s.from("currencies").select("id,code").in("id",cIds):Promise.resolve({data:[]} as any)
  ]);

  const vendorIds=[...new Set((pr.data??[]).map((x:any)=>x.vendor_id).filter(Boolean))];
  const vr=vendorIds.length?await s.from("vendors").select("id,vendor_name,legal_name").in("id",vendorIds):{data:[] as any[]};

  const pm=new Map<string,string>((pr.data??[]).map((x:any)=>[String(x.id),String(x.po_number)]));
  const poVendor=new Map<string,string>((pr.data??[]).map((x:any)=>[String(x.id),String(x.vendor_id||"")]));
  const vm=new Map<string,string>((vr.data??[]).map((x:any)=>[String(x.id),String(x.legal_name||x.vendor_name||"—")]));
  const cm=new Map<string,string>((cr.data??[]).map((x:any)=>[String(x.id),String(x.code)]));

  return <div className="mx-auto max-w-[1600px]">
    {q.deleted?<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Payment deleted from active registers. Paid totals will recalculate from active payment records.</div>:null}
    {q.error?<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{q.error}</div>:null}

    <div className="flex items-end justify-between">
      <div><div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Accounts Payable</div><h1 className="mt-2 text-3xl font-bold">Payments</h1><p className="mt-2 text-sm text-slate-500">Confirmed actual payments, historical entries and bank references.</p></div>
      <Link href="/payments/new" className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white dark:bg-blue-600">Record Payment</Link>
    </div>

    {r.error?<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{r.error.message}</div>:null}

    <div className="mccs-card mt-7 overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
            <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">PO</th><th className="px-5 py-3">Supplier / Contractor</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Payment Ref</th><th className="px-5 py-3">Bank Ref</th><th className="px-5 py-3">History</th><th className="px-5 py-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-800">
            {rows.map((x:any)=>{
              const label=x.payment_reference||`${x.payment_date}-${Number(x.paid_amount||0)}`;
              const vendorId=poVendor.get(String(x.purchase_order_id))||"";
              return <tr key={x.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                <td className="px-5 py-4">{x.payment_date}</td>
                <td className="px-5 py-4 font-bold">{pm.get(String(x.purchase_order_id))||"—"}</td>
                <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{vm.get(vendorId)||"—"}</td>
                <td className="px-5 py-4">{cm.get(String(x.currency_id))||""} {Number(x.paid_amount||0).toLocaleString()}</td>
                <td className="px-5 py-4">{x.payment_reference||"—"}</td>
                <td className="px-5 py-4">{x.bank_reference||"—"}</td>
                <td className="px-5 py-4">{x.is_historical?<span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Historical</span>:"—"}</td>
                <td className="px-5 py-4"><div className="flex gap-3"><Link href={`/payments/${x.id}/edit`} className="font-bold text-blue-700">Edit</Link>{isSuperAdmin?<SuperAdminDelete entity="payment" entityId={x.id} entityLabel={label} idField="payment_id" action={deletePayment}/>:null}</div></td>
              </tr>
            })}
            {!rows.length?<tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">No payments recorded yet.</td></tr>:null}
          </tbody>
        </table>
      </div>
    </div>
  </div>
}
