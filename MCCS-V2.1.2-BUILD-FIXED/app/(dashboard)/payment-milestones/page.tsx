import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function Page(){
 const supabase=await createClient();if(!supabase)return null;
 const [mr,sr]=await Promise.all([
   supabase.from("payment_milestones").select("id,purchase_order_id,milestone_name,percentage,fixed_amount,planned_due_date,payment_due_date,status").order("planned_due_date"),
   supabase.from("po_milestone_summary").select("*")
 ]);
 const rows=mr.data??[]; const sums=sr.data??[]; const poIds=[...new Set(rows.map((r:any)=>r.purchase_order_id))];
 const pr=poIds.length?await supabase.from("purchase_orders").select("id,po_number,current_value,currency_id").in("id",poIds):{data:[]} as any;
 const pos=new Map<string,any>((pr.data??[]).map((p:any)=>[String(p.id),p]));
 const cids=[...new Set((pr.data??[]).map((p:any)=>p.currency_id).filter(Boolean))];
 const cr=cids.length?await supabase.from("currencies").select("id,code").in("id",cids):{data:[]} as any; const currencies=new Map<string,string>((cr.data??[]).map((c:any)=>[String(c.id),String(c.code??"")]));
 const smap=new Map<string,any>(sums.map((s:any)=>[String(s.purchase_order_id),s]));
 return <div className="mx-auto max-w-[1600px]"><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">MCCS</div><h1 className="mt-2 text-3xl font-bold">Payment Milestones</h1><p className="mt-2 text-sm text-slate-500">Contractual payment obligations, allocation and remaining PO exposure.</p>
 <div className="mt-6 grid gap-4 md:grid-cols-3">{sums.slice(0,6).map((s:any)=>{const p=pos.get(s.purchase_order_id);return <div key={s.purchase_order_id} className="mccs-card rounded-2xl p-5"><div className="text-xs font-bold uppercase text-slate-500">{s.po_number}</div><div className="mt-2 text-2xl font-bold">{Number(s.allocated_percentage||0).toFixed(2)}% allocated</div><div className="mt-2 text-sm text-slate-500">Remaining: {Number(s.remaining_percentage||0).toFixed(2)}% • {currencies.get(p?.currency_id)||""} {Number(s.remaining_amount||0).toLocaleString()}</div></div>})}</div>
 <div className="mccs-card mt-6 overflow-hidden rounded-2xl"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">PO</th><th className="px-5 py-3">Milestone</th><th className="px-5 py-3">%</th><th className="px-5 py-3">Calculated Amount</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Payment Due</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y">{rows.map((m:any)=>{const p=pos.get(m.purchase_order_id);const amt=m.percentage!=null?Number(p?.current_value||0)*Number(m.percentage)/100:Number(m.fixed_amount||0);return <tr key={m.id}><td className="px-5 py-4 font-bold">{p?.po_number||"—"}</td><td className="px-5 py-4">{m.milestone_name}</td><td className="px-5 py-4 font-semibold">{m.percentage!=null?`${Number(m.percentage).toFixed(2)}%`:"—"}</td><td className="px-5 py-4">{currencies.get(p?.currency_id)||""} {amt.toLocaleString()}</td><td className="px-5 py-4">{m.planned_due_date||"—"}</td><td className="px-5 py-4">{m.payment_due_date||"—"}</td><td className="px-5 py-4 capitalize">{m.status}</td></tr>})}{!rows.length?<tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No payment milestones yet.</td></tr>:null}</tbody></table></div></div>;
}
