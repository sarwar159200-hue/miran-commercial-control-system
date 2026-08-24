import Link from "next/link";
import {ArrowUpRight,Banknote,CalendarClock,FileCheck2,ReceiptText,ShoppingCart,WalletCards} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {DashboardCharts} from "@/components/dashboard-charts";
import {VendorDashboardFilter} from "@/components/vendor-dashboard-filter";

export const dynamic="force-dynamic";

type MoneyRow=[string,number];

export default async function DashboardPage({searchParams}:{searchParams:Promise<{vendor?:string}>}){
  const q=await searchParams;
  const selectedVendor=String(q.vendor||"");
  const s=await createClient();
  if(!s)return null;

  const [por,mr,ir,pyr,vr,cr]=await Promise.all([
    s.from("purchase_orders").select("id,po_number,vendor_id,current_value,currency_id,is_deleted"),
    s.from("payment_milestones").select("id,purchase_order_id,milestone_name,percentage,fixed_amount,payment_due_date,planned_due_date,status,is_deleted").eq("is_deleted",false),
    s.from("invoices").select("id,purchase_order_id,invoice_number,certified_amount,currency_id,status,is_deleted").eq("is_deleted",false),
    s.from("payments").select("id,purchase_order_id,payment_milestone_id,paid_amount,currency_id,payment_date,payment_reference,is_deleted").eq("is_deleted",false),
    s.from("vendors").select("id,vendor_name,is_active").order("vendor_name"),
    s.from("currencies").select("id,code")
  ]);

  const allPos=(por.data??[]).filter((p:any)=>!p.is_deleted);
  const allMilestones=mr.data??[];
  const allInvoices=ir.data??[];
  const allPayments=pyr.data??[];
  const vendors=(vr.data??[]).filter((v:any)=>v.is_active!==false).map((v:any)=>({id:String(v.id),name:String(v.vendor_name||"Unnamed Vendor")}));
  const selectedVendorName=vendors.find(v=>v.id===selectedVendor)?.name||"";

  const pos=selectedVendor?allPos.filter((p:any)=>String(p.vendor_id)===selectedVendor):allPos;
  const poIds=new Set(pos.map((p:any)=>String(p.id)));
  const milestones=selectedVendor?allMilestones.filter((m:any)=>poIds.has(String(m.purchase_order_id))):allMilestones;
  const invoices=selectedVendor?allInvoices.filter((i:any)=>poIds.has(String(i.purchase_order_id))):allInvoices;
  const payments=selectedVendor?allPayments.filter((p:any)=>poIds.has(String(p.purchase_order_id))):allPayments;

  const cMap=new Map<string,string>((cr.data??[]).map((x:any)=>[String(x.id),String(x.code)]));
  const pmap=new Map<string,any>(pos.map((p:any)=>[String(p.id),p]));
  const vmap=new Map<string,string>((vr.data??[]).map((v:any)=>[String(v.id),String(v.vendor_name??"Unknown")]));

  function totals(rows:any[],field:string):MoneyRow[]{
    const m=new Map<string,number>();
    for(const x of rows){const c=cMap.get(String(x.currency_id))||"N/A";m.set(c,(m.get(c)||0)+Number(x[field]||0));}
    return [...m].sort((a,b)=>a[0].localeCompare(b[0]));
  }

  const committed=totals(pos,"current_value");
  const certified=totals(invoices,"certified_amount");
  const paid=totals(payments,"paid_amount");
  const paidMap=new Map<string,number>(paid);
  const remaining=committed.map(([c,v])=>[c,Math.max(v-(paidMap.get(c)||0),0)] as MoneyRow);

  const vendorData:any[]=[];
  for(const p of pos){vendorData.push({name:`${vmap.get(String(p.vendor_id))||"Unknown"} · ${cMap.get(String(p.currency_id))||""}`,value:Number(p.current_value||0)});}

  const statusMap=new Map<string,number>();
  milestones.forEach((m:any)=>{const k=String(m.status||"planned").replaceAll("_"," ");statusMap.set(k,(statusMap.get(k)||0)+1);});
  const statusData=[...statusMap].map(([name,value])=>({name,value}));

  const months=new Map<string,{month:string;due:number;paid:number}>();
  milestones.forEach((m:any)=>{if(!m.payment_due_date)return;const key=String(m.payment_due_date).slice(0,7),p=pmap.get(String(m.purchase_order_id));const amt=m.percentage!=null?Number(p?.current_value||0)*Number(m.percentage)/100:Number(m.fixed_amount||0);const x=months.get(key)||{month:key,due:0,paid:0};x.due+=amt;months.set(key,x);});
  payments.forEach((p:any)=>{if(!p.payment_date)return;const key=String(p.payment_date).slice(0,7),x=months.get(key)||{month:key,due:0,paid:0};x.paid+=Number(p.paid_amount||0);months.set(key,x);});
  const cashflowData=[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);

  // Prefer direct milestone-linked payments. Any legacy/unlinked payment is then allocated
  // oldest-first within its PO so historical data continues to behave correctly.
  const directPaidByMilestone=new Map<string,number>();
  const unlinkedPaidByPo=new Map<string,number>();
  payments.forEach((p:any)=>{
    const amount=Number(p.paid_amount||0);
    if(p.payment_milestone_id)directPaidByMilestone.set(String(p.payment_milestone_id),(directPaidByMilestone.get(String(p.payment_milestone_id))||0)+amount);
    else unlinkedPaidByPo.set(String(p.purchase_order_id),(unlinkedPaidByPo.get(String(p.purchase_order_id))||0)+amount);
  });
  const outstandingMilestones:any[]=[];
  for(const po of pos){
    let legacyCredit=unlinkedPaidByPo.get(String(po.id))||0;
    const poMilestones=milestones.filter((m:any)=>String(m.purchase_order_id)===String(po.id)&&m.payment_due_date).sort((a:any,b:any)=>String(a.payment_due_date).localeCompare(String(b.payment_due_date)));
    for(const m of poMilestones){
      const fullAmount=m.percentage!=null?Number(po.current_value||0)*Number(m.percentage)/100:Number(m.fixed_amount||0);
      const directPaid=Math.min(Math.max(directPaidByMilestone.get(String(m.id))||0,0),Math.max(fullAmount,0));
      let outstanding=Math.max(fullAmount-directPaid,0);
      const legacyApplied=Math.min(Math.max(legacyCredit,0),outstanding);
      outstanding=Math.max(outstanding-legacyApplied,0);
      legacyCredit=Math.max(legacyCredit-legacyApplied,0);
      if(outstanding>0.005)outstandingMilestones.push({...m,_full_amount:fullAmount,_remaining_amount:outstanding,_direct_paid:directPaid,_legacy_applied:legacyApplied});
    }
  }
  const upcoming=outstandingMilestones.sort((a:any,b:any)=>String(a.payment_due_date).localeCompare(String(b.payment_due_date))).slice(0,6);
  const paymentHistory=[...payments].filter((p:any)=>p.payment_date).sort((a:any,b:any)=>String(b.payment_date).localeCompare(String(a.payment_date))).slice(0,8);

  const supplierOutstanding=remaining.reduce((a,[,v])=>a+v,0);
  const supplierPaid=paid.reduce((a,[,v])=>a+v,0);
  const nextMilestone=upcoming[0]||null;
  const nextDue=nextMilestone?.payment_due_date||null;
  const nextPo=nextMilestone?pmap.get(String(nextMilestone.purchase_order_id)):null;
  const nextDueCurrency=nextPo?cMap.get(String(nextPo.currency_id))||"":"";
  const nextDueAmount=nextMilestone?Number(nextMilestone._remaining_amount||0):0;

  return <div className="mx-auto max-w-[1600px]">
    <div className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div><div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Miran Energy • MCCS</div><h1 className="mt-2 text-3xl font-bold">Commercial Executive Dashboard</h1><p className="mt-2 text-sm text-slate-500">Multi-currency commitments, certification, payments and upcoming exposure. Currencies are never incorrectly combined.</p></div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end"><VendorDashboardFilter vendors={vendors} selectedVendor={selectedVendor}/><div className="flex gap-2"><a href="/api/export/commercial" className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold dark:bg-slate-900">Export Excel</a><Link href="/purchase-orders/new" className="flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-2.5 text-sm font-bold text-white dark:bg-blue-600">New Purchase Order<ArrowUpRight className="h-4 w-4"/></Link></div></div>
    </div>

    {selectedVendor?<section className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-slate-950">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center"><div><div className="text-[11px] font-extrabold uppercase tracking-[.16em] text-blue-700">Supplier / Contractor Financial View</div><h2 className="mt-1 text-xl font-bold">{selectedVendorName}</h2></div><div className="text-xs text-slate-500">{pos.length} PO{pos.length===1?"":"s"} • {payments.length} payment{payments.length===1?"":"s"} • {milestones.length} milestone{milestones.length===1?"":"s"}</div></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric title="Total PO / Commitment" icon={ShoppingCart} rows={committed}/>
        <MiniMetric title="Paid to Date" icon={Banknote} rows={paid} helper={`${payments.length} actual payment${payments.length===1?"":"s"}`}/>
        <MiniMetric title="Remaining to Pay" icon={WalletCards} rows={remaining}/>
        <MiniMetric title="Next Payment Due" icon={CalendarClock} value={nextDue?formatDate(nextDue):"No date"} helper={nextDue?`${nextDueCurrency} ${nextDueAmount.toLocaleString()} • ${nextMilestone?.milestone_name||"Milestone"}`:"No outstanding scheduled milestone"}/>
      </div>
    </section>:null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MoneyCard title="Committed" icon={ShoppingCart} rows={committed} helper={`${pos.length} active PO records`}/><MoneyCard title="Certified" icon={FileCheck2} rows={certified} helper={`${invoices.length} invoice records`}/><MoneyCard title="Paid" icon={Banknote} rows={paid} helper={`${payments.length} payment records`}/><MoneyCard title="Remaining" icon={ReceiptText} rows={remaining} helper="Committed less paid by currency"/></div>

    {selectedVendor?<div className="my-5 grid gap-5 xl:grid-cols-2">
      <section className="mccs-card rounded-2xl p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Paid Payment History</h2><p className="mt-1 text-sm text-slate-500">Actual payments made to {selectedVendorName}, including payment date and reference.</p></div><Banknote className="h-5 w-5 text-emerald-600"/></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3 pr-3">Date Paid</th><th className="py-3 pr-3">PO</th><th className="py-3 pr-3">Amount</th><th className="py-3">Reference</th></tr></thead><tbody className="divide-y">{paymentHistory.map((p:any)=><tr key={p.id}><td className="py-3 pr-3 font-semibold">{formatDate(p.payment_date)}</td><td className="py-3 pr-3">{pmap.get(String(p.purchase_order_id))?.po_number||"—"}</td><td className="py-3 pr-3 font-bold text-emerald-700">{cMap.get(String(p.currency_id))||""} {Number(p.paid_amount||0).toLocaleString()}</td><td className="py-3">{p.payment_reference||"—"}</td></tr>)}{!paymentHistory.length?<tr><td colSpan={4} className="py-8 text-center text-slate-500">No payments recorded for this supplier yet.</td></tr>:null}</tbody></table></div></section>
      <section className="mccs-card rounded-2xl p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Remaining Payment Schedule</h2><p className="mt-1 text-sm text-slate-500">Upcoming contractual milestones and the date each payment is due.</p></div><CalendarClock className="h-5 w-5 text-blue-700"/></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3 pr-3">Due Date</th><th className="py-3 pr-3">PO</th><th className="py-3 pr-3">Milestone</th><th className="py-3">Amount</th></tr></thead><tbody className="divide-y">{upcoming.map((m:any)=>{const p=pmap.get(String(m.purchase_order_id)),amt=Number(m._remaining_amount??(m.percentage!=null?Number(p?.current_value||0)*Number(m.percentage)/100:Number(m.fixed_amount||0))),cur=cMap.get(String(p?.currency_id))||"";return <tr key={m.id}><td className="py-3 pr-3 font-semibold">{formatDate(m.payment_due_date)}</td><td className="py-3 pr-3">{p?.po_number||"—"}</td><td className="py-3 pr-3">{m.milestone_name||"Milestone"}</td><td className="py-3 font-bold text-blue-700">{cur} {amt.toLocaleString()}</td></tr>})}{!upcoming.length?<tr><td colSpan={4} className="py-8 text-center text-slate-500">No upcoming payment milestone is scheduled.</td></tr>:null}</tbody></table></div></section>
    </div>:null}

    <div className="mccs-card my-5 rounded-2xl p-6"><h2 className="text-lg font-bold">Upcoming Payment Milestones</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{upcoming.map((m:any)=>{const p=pmap.get(String(m.purchase_order_id)),amt=Number(m._remaining_amount??(m.percentage!=null?Number(p?.current_value||0)*Number(m.percentage)/100:Number(m.fixed_amount||0))),cur=cMap.get(String(p?.currency_id))||"",supplier=vmap.get(String(p?.vendor_id))||"Unknown Supplier / Contractor";return <div key={m.id} className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div className="font-bold">{formatDate(m.payment_due_date)}</div><div className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{supplier}</div></div><div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{m.milestone_name||"Milestone"} • {cur} {amt.toLocaleString()}</div><div className="mt-1 text-xs capitalize text-slate-500">{String(m.status).replaceAll("_"," ")}</div></div>})}{!upcoming.length?<div className="text-sm text-slate-500">No upcoming milestone dates.</div>:null}</div></div>
    <DashboardCharts vendorData={vendorData} statusData={statusData} cashflowData={cashflowData}/>
  </div>;
}

function formatDate(value:string){if(!value)return"—";const d=new Date(`${value}T00:00:00`);return Number.isNaN(d.getTime())?value:d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}

function MiniMetric({title,rows,value,helper,icon:Icon}:{title:string;rows?:MoneyRow[];value?:string;helper?:string;icon:any}){return <div className="rounded-xl border border-white/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">{title}</div><Icon className="h-4 w-4 text-blue-700"/></div>{value?<div className="mt-2 text-xl font-bold">{value}</div>:<div className="mt-2 space-y-1">{(rows||[]).map(([c,v])=><div key={c} className="flex items-baseline justify-between gap-4"><span className="text-xs font-bold text-blue-700">{c}</span><span className="text-lg font-bold">{v.toLocaleString()}</span></div>)}{!(rows||[]).length?<div className="text-lg font-bold">0</div>:null}</div>}{helper?<div className="mt-2 text-[11px] text-slate-500">{helper}</div>:null}</div>}

function MoneyCard({title,rows,helper,icon:Icon}:{title:string;rows:MoneyRow[];helper:string;icon:any}){return <div className="mccs-card rounded-2xl p-5"><div className="flex justify-between"><div className="text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">{title}</div><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon className="h-5 w-5"/></div></div><div className="mt-3 space-y-1">{rows.slice(0,3).map(([c,v])=><div key={c} className="flex items-baseline justify-between"><span className="text-sm font-bold text-blue-700">{c}</span><span className="text-xl font-bold">{v.toLocaleString()}</span></div>)}{!rows.length?<div className="text-2xl font-bold">0</div>:null}</div><div className="mt-4 text-xs text-slate-500">{helper}</div></div>}
