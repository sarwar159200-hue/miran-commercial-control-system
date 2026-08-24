import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";
import { softDeletePurchaseOrder } from "../_actions/commercial";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ warning?: string; deleted?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data:{user} } = await supabase.auth.getUser();
  const {data:me}=user?await supabase.from("profiles").select("is_super_admin").eq("id",user.id).maybeSingle():{data:null as any};
  const isSuperAdmin=Boolean(me?.is_super_admin || user?.email?.toLowerCase()==="sarwar.khalid@miranenergy.com");
  const poResult = await supabase.from("purchase_orders").select("id,po_number,po_date,current_value,status,is_historical,is_deleted,vendor_id,currency_id,project_id").eq("is_deleted",false).order("po_date", { ascending: false });
  const pos = poResult.data ?? [];
  const vendorIds=[...new Set(pos.map((p:any)=>p.vendor_id).filter(Boolean))],currencyIds=[...new Set(pos.map((p:any)=>p.currency_id).filter(Boolean))],projectIds=[...new Set(pos.map((p:any)=>p.project_id).filter(Boolean))];
  const [vr,cr,pr]=await Promise.all([vendorIds.length?supabase.from("vendors").select("id,vendor_name").in("id",vendorIds):Promise.resolve({data:[]} as any),currencyIds.length?supabase.from("currencies").select("id,code").in("id",currencyIds):Promise.resolve({data:[]} as any),projectIds.length?supabase.from("projects").select("id,project_code").in("id",projectIds):Promise.resolve({data:[]} as any)]);
  const vendors=new Map<string,string>((vr.data??[]).map((x:any)=>[String(x.id),String(x.vendor_name??"—")])),currencies=new Map<string,string>((cr.data??[]).map((x:any)=>[String(x.id),String(x.code??"")])),projects=new Map<string,string>((pr.data??[]).map((x:any)=>[String(x.id),String(x.project_code??"—")]));
  return <div className="mx-auto max-w-[1600px]">
    {params.deleted?<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Purchase Order deleted from active MCCS registers. Audit history has been retained.</div>:null}
    {params.error?<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{params.error}</div>:null}
    {params.warning?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{params.warning}</div>:null}
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Commitments</div><h1 className="mt-2 text-3xl font-bold">Purchase Orders</h1><p className="mt-2 text-sm text-slate-500">New, approved and historical PO register.</p></div><Link href="/purchase-orders/new" className="inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white"><FilePlus2 className="h-4 w-4"/>New Purchase Order</Link></div>
    <div className="mccs-card mt-7 overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">PO Number</th><th className="px-5 py-3">Project</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">PO Date</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">History</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
      {pos.map((po:any)=><tr key={po.id}><td className="px-5 py-4 font-bold"><Link href={`/purchase-orders/${po.id}`} className="text-blue-700 hover:underline">{po.po_number}</Link></td><td className="px-5 py-4">{projects.get(po.project_id)||"—"}</td><td className="px-5 py-4">{vendors.get(po.vendor_id)||"—"}</td><td className="px-5 py-4">{po.po_date}</td><td className="px-5 py-4 font-semibold">{currencies.get(po.currency_id)||""} {Number(po.current_value||0).toLocaleString()}</td><td className="px-5 py-4 capitalize">{po.status}</td><td className="px-5 py-4">{po.is_historical?<span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Historical</span>:"—"}</td><td className="px-5 py-4"><div className="flex gap-3"><Link href={`/purchase-orders/${po.id}`} className="font-bold text-blue-700">Open</Link>{isSuperAdmin?<SuperAdminDelete entity="purchase_order" entityId={po.id} entityLabel={po.po_number} idField="po_id" action={softDeletePurchaseOrder}/>:null}</div></td></tr>)}
      {!pos.length?<tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">No purchase orders yet.</td></tr>:null}
    </tbody></table></div></div>
  </div>;
}
