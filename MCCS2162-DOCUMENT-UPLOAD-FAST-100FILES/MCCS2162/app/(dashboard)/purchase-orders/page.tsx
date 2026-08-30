import Link from "next/link";
import { FilePlus2, History, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";
import { purgeDeletedPurchaseOrder, restorePurchaseOrder, softDeletePurchaseOrder } from "../_actions/commercial";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ warning?: string; deleted?: string; restored?: string; purged?: string; error?: string; view?: string; history?: string }> }) {
  const params = await searchParams;
  const historyMode = params.view === "history";
  const supabase = await createClient();
  if (!supabase) return null;
  const { data:{user} } = await supabase.auth.getUser();
  const {data:me}=user?await supabase.from("profiles").select("is_super_admin").eq("id",user.id).maybeSingle():{data:null as any};
  const isSuperAdmin=Boolean(me?.is_super_admin || user?.email?.toLowerCase()==="sarwar.khalid@miranenergy.com");

  const poQuery = supabase.from("purchase_orders")
    .select("id,po_number,po_date,current_value,status,is_historical,is_deleted,deleted_at,deleted_by,delete_reason,vendor_id,currency_id,project_id")
    .eq("is_deleted", historyMode)
    .order(historyMode ? "deleted_at" : "po_date", { ascending: false, nullsFirst: false });
  const { data: posData } = await poQuery;
  const pos = posData ?? [];

  const vendorIds=[...new Set(pos.map((p:any)=>p.vendor_id).filter(Boolean))],currencyIds=[...new Set(pos.map((p:any)=>p.currency_id).filter(Boolean))],projectIds=[...new Set(pos.map((p:any)=>p.project_id).filter(Boolean))],deletedByIds=[...new Set(pos.map((p:any)=>p.deleted_by).filter(Boolean))];
  const [vr,cr,pr,dr]=await Promise.all([
    vendorIds.length?supabase.from("vendors").select("id,vendor_name").in("id",vendorIds):Promise.resolve({data:[]} as any),
    currencyIds.length?supabase.from("currencies").select("id,code").in("id",currencyIds):Promise.resolve({data:[]} as any),
    projectIds.length?supabase.from("projects").select("id,project_code").in("id",projectIds):Promise.resolve({data:[]} as any),
    deletedByIds.length?supabase.from("profiles").select("id,full_name,preferred_name,email").in("id",deletedByIds):Promise.resolve({data:[]} as any),
  ]);
  const vendors=new Map<string,string>((vr.data??[]).map((x:any)=>[String(x.id),String(x.vendor_name??"—")]));
  const currencies=new Map<string,string>((cr.data??[]).map((x:any)=>[String(x.id),String(x.code??"")]));
  const projects=new Map<string,string>((pr.data??[]).map((x:any)=>[String(x.id),String(x.project_code??"—")]));
  const deleters=new Map<string,string>((dr.data??[]).map((x:any)=>[String(x.id),String(x.preferred_name||x.full_name||x.email||"User")]));

  let selectedHistory:any[]=[];
  let selectedPo:any=null;
  if (params.history && isSuperAdmin) {
    selectedPo = pos.find((x:any)=>String(x.id)===String(params.history)) || (await supabase.from("purchase_orders").select("id,po_number").eq("id",params.history).maybeSingle()).data;
    const {data:logs}=await supabase.from("audit_logs")
      .select("id,actor_user_id,entity_type,action,before_data,after_data,created_at")
      .eq("entity_id",params.history)
      .in("entity_type",["purchase_order","purchase_orders","purchase_order_purge"])
      .order("created_at",{ascending:false}).limit(100);
    selectedHistory=logs??[];
  }

  const historyActorIds=[...new Set(selectedHistory.map((x:any)=>x.actor_user_id).filter(Boolean))];
  const historyProfiles=historyActorIds.length?(await supabase.from("profiles").select("id,full_name,preferred_name,email").in("id",historyActorIds)).data??[]:[];
  const historyActors=new Map<string,string>(historyProfiles.map((x:any)=>[String(x.id),String(x.preferred_name||x.full_name||x.email||"User")]));

  return <div className="mx-auto max-w-[1600px]">
    {params.deleted?<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Purchase Order moved to Deleted / History. Audit history has been retained.</div>:null}
    {params.restored?<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Purchase Order restored to the active register.</div>:null}
    {params.purged?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Test Purchase Order permanently purged. A minimal purge audit event was retained.</div>:null}
    {params.error?<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{params.error}</div>:null}
    {params.warning?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{params.warning}</div>:null}

    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Commitments</div><h1 className="mt-2 text-3xl font-bold">Purchase Orders</h1><p className="mt-2 text-sm text-slate-500">Active PO register plus Super Admin deleted-record and audit history controls.</p></div>
      <Link href="/purchase-orders/new" className="inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white"><FilePlus2 className="h-4 w-4"/>New Purchase Order</Link>
    </div>

    <div className="mt-6 flex flex-wrap gap-2">
      <Link href="/purchase-orders" className={`rounded-xl px-4 py-2.5 text-sm font-bold ${!historyMode?"bg-blue-700 text-white":"border bg-white text-slate-700"}`}>Active Purchase Orders</Link>
      {isSuperAdmin?<Link href="/purchase-orders?view=history" className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${historyMode?"bg-[#07111f] text-white":"border bg-white text-slate-700"}`}><History className="h-4 w-4"/>Deleted / History</Link>:null}
    </div>

    <div className="mccs-card mt-5 overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">PO Number</th><th className="px-5 py-3">Project</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">PO Date</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Status</th>{historyMode?<><th className="px-5 py-3">Deleted</th><th className="px-5 py-3">Reason</th></>:<th className="px-5 py-3">History</th>}<th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
      {pos.map((po:any)=><tr key={po.id}><td className="px-5 py-4 font-bold"><Link href={`/purchase-orders/${po.id}`} className="text-blue-700 hover:underline">{po.po_number}</Link></td><td className="px-5 py-4">{projects.get(String(po.project_id))||"—"}</td><td className="px-5 py-4">{vendors.get(String(po.vendor_id))||"—"}</td><td className="px-5 py-4">{po.po_date}</td><td className="px-5 py-4 font-semibold">{currencies.get(String(po.currency_id))||""} {Number(po.current_value||0).toLocaleString()}</td><td className="px-5 py-4 capitalize">{po.status}</td>
        {historyMode?<><td className="px-5 py-4"><div className="font-semibold">{fmtDate(po.deleted_at)}</div><div className="mt-1 text-xs text-slate-500">by {deleters.get(String(po.deleted_by))||"System"}</div></td><td className="max-w-[260px] px-5 py-4 text-slate-600">{po.delete_reason||"—"}</td></>:<td className="px-5 py-4"><Link href={`/purchase-orders?history=${po.id}`} className="font-bold text-blue-700">View History</Link></td>}
        <td className="px-5 py-4"><div className="flex flex-wrap items-center gap-3">
          {!historyMode?<><Link href={`/purchase-orders/${po.id}`} className="font-bold text-blue-700">Open</Link>{isSuperAdmin?<Link href={`/purchase-orders/${po.id}/edit`} className="font-bold text-emerald-700">Edit PO & Milestones</Link>:null}{isSuperAdmin?<SuperAdminDelete entity="purchase_order" entityId={po.id} entityLabel={po.po_number} idField="po_id" action={softDeletePurchaseOrder}/>:null}</>:null}
          {historyMode&&isSuperAdmin?<><form action={restorePurchaseOrder}><input type="hidden" name="po_id" value={po.id}/><button className="inline-flex items-center gap-1 font-bold text-emerald-700"><RotateCcw className="h-4 w-4"/>Restore</button></form><Link href={`/purchase-orders?view=history&history=${po.id}`} className="font-bold text-blue-700">Audit Log</Link><SuperAdminDelete mode="purge" entity="purchase_order" entityId={po.id} entityLabel={po.po_number} idField="po_id" action={purgeDeletedPurchaseOrder} className="inline-flex items-center gap-1 font-bold text-red-700"/></>:null}
        </div></td></tr>)}
      {!pos.length?<tr><td colSpan={historyMode?9:8} className="px-5 py-12 text-center text-slate-500">{historyMode?"No deleted Purchase Orders are retained in history.":"No purchase orders yet."}</td></tr>:null}
    </tbody></table></div></div>

    {params.history&&isSuperAdmin?<section className="mccs-card mt-6 overflow-hidden rounded-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-lg font-bold">PO Audit History — {selectedPo?.po_number||"Selected PO"}</h2><p className="mt-1 text-sm text-slate-500">Who created, changed, deleted, restored or purged this Purchase Order.</p></div><Link href={historyMode?"/purchase-orders?view=history":"/purchase-orders"} className="font-bold text-blue-700">Close</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date / Time</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Entity</th><th className="px-5 py-3">Details</th></tr></thead><tbody className="divide-y">{selectedHistory.map((x:any)=><tr key={x.id}><td className="px-5 py-4">{fmtDate(x.created_at)}</td><td className="px-5 py-4 font-semibold">{historyActors.get(String(x.actor_user_id))||"System"}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{x.action}</span></td><td className="px-5 py-4">{x.entity_type}</td><td className="max-w-[420px] px-5 py-4 text-xs text-slate-600">{JSON.stringify(x.after_data||x.before_data||{}).slice(0,420)}</td></tr>)}{!selectedHistory.length?<tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No audit events were found for this PO.</td></tr>:null}</tbody></table></div></section>:null}
  </div>;
}
