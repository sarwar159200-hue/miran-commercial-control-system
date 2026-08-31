import Link from "next/link";
import {ArrowUpRight,Banknote,CalendarClock,FileCheck2,ReceiptText,ShoppingCart,WalletCards} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {DashboardCharts} from "@/components/dashboard-charts";
import {VendorDashboardFilter} from "@/components/vendor-dashboard-filter";
import {updateDashboardMilestone} from "../_actions/commercial";

export const dynamic="force-dynamic";

type MoneyRow=[string,number];

export default async function DashboardPage({searchParams}:{searchParams:Promise<{vendor?:string;month?:string;day?:string;summary?:string;fpo?:string;fsupplier?:string;fpackage?:string;fmilestone?:string;fpct?:string;fdue?:string;foverdue?:string;foutstanding?:string;fstatus?:string;factual?:string}>}){
  const q=await searchParams;
  const selectedVendor=String(q.vendor||"");
  const s=await createClient();
  if(!s)return null;

  const {data:{user}}=await s.auth.getUser();
  const [{data:profile},{data:userRoles},{data:allRoles}]=await Promise.all([
    user?s.from("profiles").select("is_super_admin").eq("id",user.id).maybeSingle():Promise.resolve({data:null} as any),
    user?s.from("user_roles").select("role_id").eq("user_id",user.id):Promise.resolve({data:[]} as any),
    s.from("roles").select("id,role_code")
  ]);
  const roleIds=new Set((userRoles??[]).map((x:any)=>String(x.role_id)));
  const roleCodes=new Set((allRoles??[]).filter((r:any)=>roleIds.has(String(r.id))).map((r:any)=>String(r.role_code||"").toLowerCase()));
  const canEditMilestonePayment=Boolean(profile?.is_super_admin||user?.email?.toLowerCase()==="sarwar.khalid@miranenergy.com"||["accounts_payable","account_payable","accounts-payable","ap"].some(r=>roleCodes.has(r)));
  const milestoneStatuses=[["planned","Planned"],["awaiting_evidence","Awaiting Evidence"],["eligible","Eligible"],["awaiting_invoice","Awaiting Invoice"],["under_verification","Under Verification"],["certified","Certified"],["submitted_to_ap","Submitted to AP"],["paid","Paid"],["on_hold","On Hold"],["cancelled","Cancelled"]];

  const [por,mr,ir,pyr,vr,cr,pr]=await Promise.all([
    s.from("purchase_orders").select("id,po_number,vendor_id,project_id,current_value,currency_id,is_deleted").eq("is_deleted",false),
    s.from("payment_milestones").select("id,purchase_order_id,milestone_name,percentage,fixed_amount,payment_due_date,actual_payment_date,planned_due_date,status,is_deleted").eq("is_deleted",false),
    s.from("invoices").select("id,purchase_order_id,invoice_number,invoice_amount,certified_amount,currency_id,status,workflow_status,is_deleted").eq("is_deleted",false),
    s.from("payments").select("id,purchase_order_id,payment_milestone_id,paid_amount,currency_id,payment_date,payment_reference,is_deleted").eq("is_deleted",false),
    s.from("vendors").select("id,vendor_name,is_active").order("vendor_name"),
    s.from("currencies").select("id,code"),
    s.from("projects").select("id,project_name,project_code,vendor_id,is_active,is_deleted").eq("is_deleted",false)
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
  const milestonesByPo=new Map<string,any[]>();
  for(const m of milestones){const key=String(m.purchase_order_id);const list=milestonesByPo.get(key)||[];list.push(m);milestonesByPo.set(key,list);}
  const invoicesByPo=new Map<string,any[]>();
  for(const i of invoices){const key=String(i.purchase_order_id);const list=invoicesByPo.get(key)||[];list.push(i);invoicesByPo.set(key,list);}
  const paymentsByPo=new Map<string,any[]>();
  for(const pay of payments){const key=String(pay.purchase_order_id);const list=paymentsByPo.get(key)||[];list.push(pay);paymentsByPo.set(key,list);}
  const posByProject=new Map<string,any[]>();
  for(const po of pos){const key=String(po.project_id||"");const list=posByProject.get(key)||[];list.push(po);posByProject.set(key,list);}
  const vmap=new Map<string,string>((vr.data??[]).map((v:any)=>[String(v.id),String(v.vendor_name??"Unknown")]));
  const projectRows=(pr.data??[]) as any[];
  const projectMap=new Map<string,string>(projectRows.map((x:any)=>[String(x.id),String(x.project_name||x.project_code||"Unnamed Package")]));
  const packagesByVendor=new Map<string,any[]>();
  for(const project of projectRows){
    const key=String(project.vendor_id||"");
    if(!key)continue;
    const list=packagesByVendor.get(key)||[];
    list.push(project);
    packagesByVendor.set(key,list);
  }
  const selectedPackages=selectedVendor?(packagesByVendor.get(selectedVendor)||[]):[];

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
  for(const p of pos){vendorData.push({vendorId:String(p.vendor_id||""),name:`${vmap.get(String(p.vendor_id))||"Unknown"} · ${cMap.get(String(p.currency_id))||""}`,value:Number(p.current_value||0)});}

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
    const poMilestones=(milestonesByPo.get(String(po.id))||[]).filter((m:any)=>m.payment_due_date).sort((a:any,b:any)=>String(a.payment_due_date).localeCompare(String(b.payment_due_date)));
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
  const outstandingSorted=outstandingMilestones.sort((a:any,b:any)=>String(a.payment_due_date).localeCompare(String(b.payment_due_date)));
  const upcoming=outstandingSorted.slice(0,6);
  const paymentHistory=[...payments].filter((p:any)=>p.payment_date).sort((a:any,b:any)=>String(b.payment_date).localeCompare(String(a.payment_date))).slice(0,8);

  // Calendar view for payment milestones. The month/day are URL-driven so the dashboard
  // remains fast and server-rendered while still supporting month navigation and drill-down.
  const today=new Date();
  const todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const defaultMonth=todayKey.slice(0,7);
  const calendarMonth=/^\d{4}-\d{2}$/.test(String(q.month||""))?String(q.month):defaultMonth;
  const [calendarYear,calendarMonthNumber]=calendarMonth.split("-").map(Number);
  const firstOfMonth=new Date(calendarYear,calendarMonthNumber-1,1);
  const lastOfMonth=new Date(calendarYear,calendarMonthNumber,0);
  const prevMonthDate=new Date(calendarYear,calendarMonthNumber-2,1);
  const nextMonthDate=new Date(calendarYear,calendarMonthNumber,1);
  const prevMonth=`${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth()+1).padStart(2,"0")}`;
  const nextMonth=`${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth()+1).padStart(2,"0")}`;
  const monthLabel=firstOfMonth.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  const dueByDate=new Map<string,any[]>();
  outstandingSorted.forEach((m:any)=>{if(!m.payment_due_date)return;const key=String(m.payment_due_date).slice(0,10);const arr=dueByDate.get(key)||[];arr.push(m);dueByDate.set(key,arr);});
  const selectedDay=/^\d{4}-\d{2}-\d{2}$/.test(String(q.day||""))?String(q.day):([...(dueByDate.keys())].find(x=>x.startsWith(calendarMonth))||"");
  const selectedDayMilestones=selectedDay?(dueByDate.get(selectedDay)||[]):[];
  const calendarDays=Array.from({length:lastOfMonth.getDate()},(_,i)=>{const day=i+1;const key=`${calendarMonth}-${String(day).padStart(2,"0")}`;return {day,key,items:dueByDate.get(key)||[]};});
  const leadingDays=firstOfMonth.getDay();
  const trailingDays=(7-((leadingDays+calendarDays.length)%7))%7;
  const overdueCount=outstandingSorted.filter((m:any)=>String(m.payment_due_date)<todayKey).length;
  const weekLimit=new Date(today.getFullYear(),today.getMonth(),today.getDate()+7);
  const weekLimitKey=`${weekLimit.getFullYear()}-${String(weekLimit.getMonth()+1).padStart(2,"0")}-${String(weekLimit.getDate()).padStart(2,"0")}`;
  const dueThisWeekCount=outstandingSorted.filter((m:any)=>String(m.payment_due_date)>=todayKey&&String(m.payment_due_date)<=weekLimitKey).length;
  const dueThisMonthCount=outstandingSorted.filter((m:any)=>String(m.payment_due_date).startsWith(defaultMonth)).length;
  const threeMonthLimit=new Date(today.getFullYear(),today.getMonth()+3,today.getDate());
  const threeMonthLimitKey=`${threeMonthLimit.getFullYear()}-${String(threeMonthLimit.getMonth()+1).padStart(2,"0")}-${String(threeMonthLimit.getDate()).padStart(2,"0")}`;
  const nextThreeMonthsCount=outstandingSorted.filter((m:any)=>String(m.payment_due_date)>=todayKey&&String(m.payment_due_date)<=threeMonthLimitKey).length;
  const summaryKey=["overdue","week","month","three-months","all"].includes(String(q.summary||""))?String(q.summary):"";
  const baseSummaryRows=summaryKey==="overdue"?outstandingSorted.filter((m:any)=>String(m.payment_due_date)<todayKey):summaryKey==="week"?outstandingSorted.filter((m:any)=>String(m.payment_due_date)>=todayKey&&String(m.payment_due_date)<=weekLimitKey):summaryKey==="month"?outstandingSorted.filter((m:any)=>String(m.payment_due_date).startsWith(defaultMonth)):summaryKey==="three-months"?outstandingSorted.filter((m:any)=>String(m.payment_due_date)>=todayKey&&String(m.payment_due_date)<=threeMonthLimitKey):summaryKey==="all"?outstandingSorted:[];
  const summaryTitle=summaryKey==="overdue"?"Overdue Milestones":summaryKey==="week"?"Milestones Due This Week":summaryKey==="month"?"Milestones Due This Month":summaryKey==="three-months"?"Milestones Due in the Next 3 Months":summaryKey==="all"?"All Outstanding Milestones":"";
  const filterValue=(key:string)=>String((q as any)[key]||"");
  const decoratedSummaryRows=baseSummaryRows.map((m:any)=>{const po=pmap.get(String(m.purchase_order_id)),supplier=vmap.get(String(po?.vendor_id))||"—",packageName=projectMap.get(String(po?.project_id))||"—",due=String(m.payment_due_date||"").slice(0,10),dueDate=due?new Date(`${due}T00:00:00`):null,todayDate=new Date(`${todayKey}T00:00:00`),overdueDays=dueDate&&due<todayKey?Math.max(0,Math.floor((todayDate.getTime()-dueDate.getTime())/86400000)):0,cur=cMap.get(String(po?.currency_id))||"",pct=m.percentage!=null?Number(m.percentage):Number(po?.current_value||0)>0?Number(m._full_amount||0)/Number(po.current_value)*100:0;return {...m,_po:po,_po_number:String(po?.po_number||"—"),_supplier:supplier,_package:packageName,_due:due,_overdue_days:overdueDays,_currency:cur,_pct:pct,_status:String(m.status||"planned"),_actual:String(m.actual_payment_date||"").slice(0,10)};});
  const filterDefs=[
    ["fpo","PO Number",(r:any)=>r._po_number],["fsupplier","Supplier / Contractor",(r:any)=>r._supplier],["fpackage","Package",(r:any)=>r._package],["fmilestone","Milestone",(r:any)=>String(r.milestone_name||"Milestone")],["fpct","%",(r:any)=>String(Number(r._pct).toLocaleString(undefined,{maximumFractionDigits:2}))],["fdue","Payment Due",(r:any)=>r._due],["foverdue","Overdue Days",(r:any)=>String(r._overdue_days)],["foutstanding","Outstanding",(r:any)=>`${r._currency} ${Number(r._remaining_amount||0).toLocaleString()}`],["fstatus","Status",(r:any)=>r._status],["factual","Actual Payment Date",(r:any)=>r._actual||"Not set"]
  ] as const;
  const summaryRows=decoratedSummaryRows.filter((r:any)=>filterDefs.every(([key,,getter])=>!filterValue(key)||getter(r)===filterValue(key)));
  const filterOptions=Object.fromEntries(filterDefs.map(([key,,getter])=>[key,[...new Set(decoratedSummaryRows.map((r:any)=>getter(r)))].sort((a:any,b:any)=>String(a).localeCompare(String(b),undefined,{numeric:true}))]));
  const filterHref=(key:string,value:string)=>{const p=new URLSearchParams();if(selectedVendor)p.set("vendor",selectedVendor);if(calendarMonth)p.set("month",calendarMonth);if(selectedDay)p.set("day",selectedDay);if(summaryKey)p.set("summary",summaryKey);for(const [k] of filterDefs){const v=k===key?value:filterValue(k);if(v)p.set(k,v);}return `/dashboard?${p.toString()}#milestone-summary-list`;};

  const outstandingByPo=new Map<string,any[]>();
  for(const m of outstandingSorted){const key=String(m.purchase_order_id);const list=outstandingByPo.get(key)||[];list.push(m);outstandingByPo.set(key,list);}
  const packageBreakdown=selectedPackages.map((pkg:any)=>{
    const packagePos=posByProject.get(String(pkg.id))||[];
    const packageInvoices:any[]=[];
    const packagePayments:any[]=[];
    const packageOutstanding:any[]=[];
    let totalMilestoneCount=0;
    for(const po of packagePos){
      const poId=String(po.id);
      packageInvoices.push(...(invoicesByPo.get(poId)||[]));
      packagePayments.push(...(paymentsByPo.get(poId)||[]));
      packageOutstanding.push(...(outstandingByPo.get(poId)||[]));
      totalMilestoneCount+=(milestonesByPo.get(poId)||[]).length;
    }
    const futureMilestones=packageOutstanding.filter((m:any)=>String(m.payment_due_date||"")>=todayKey);
    const readyInvoices=packageInvoices.filter((inv:any)=>String(inv.workflow_status||"")==="approved_for_payment");
    return {
      id:String(pkg.id),
      name:String(pkg.project_name||pkg.project_code||"Unnamed Package"),
      code:String(pkg.project_code||""),
      active:pkg.is_active!==false,
      poCount:packagePos.length,
      invoiceCount:packageInvoices.length,
      futureMilestoneCount:futureMilestones.length,
      totalMilestoneCount,
      readyCount:readyInvoices.length,
      paymentCount:packagePayments.length,
      commitment:totals(packagePos,"current_value"),
      readyAmount:totals(readyInvoices,"certified_amount"),
    };
  });

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

    {selectedVendor?<section className="mccs-card mb-5 overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-2 border-b px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between"><div><div className="text-[11px] font-extrabold uppercase tracking-[.16em] text-blue-700">Package Commercial Breakdown</div><h2 className="mt-1 text-lg font-bold">{selectedVendorName} — {packageBreakdown.length} package{packageBreakdown.length===1?"":"s"}</h2></div><Link href={`/projects?vendor=${encodeURIComponent(selectedVendor)}`} className="text-xs font-bold text-blue-700">Open all supplier packages →</Link></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-3">Package</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">POs</th><th className="px-4 py-3">Received Invoices</th><th className="px-4 py-3">Future Milestones</th><th className="px-4 py-3">Ready for Payment</th><th className="px-4 py-3">Payments</th><th className="px-4 py-3">Total Amount</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{packageBreakdown.map((pkg:any)=><tr key={pkg.id}><td className="px-4 py-4"><div className="font-bold">{pkg.name}</div>{pkg.code?<div className="mt-0.5 text-[11px] text-slate-500">{pkg.code}</div>:null}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${pkg.active?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{pkg.active?"Active":"Inactive"}</span></td><td className="px-4 py-4 font-semibold">{pkg.poCount}</td><td className="px-4 py-4 font-semibold">{pkg.invoiceCount}</td><td className="px-4 py-4"><div className="font-semibold text-blue-700">{pkg.futureMilestoneCount}</div><div className="text-[10px] text-slate-500">of {pkg.totalMilestoneCount} total</div></td><td className="px-4 py-4"><div className="font-semibold text-emerald-700">{pkg.readyCount}</div>{pkg.readyAmount.length?<div className="mt-1 text-[10px] text-slate-500">{moneyInline(pkg.readyAmount)}</div>:null}</td><td className="px-4 py-4 font-semibold">{pkg.paymentCount}</td><td className="px-4 py-4 font-bold">{moneyInline(pkg.commitment)}</td></tr>)}{!packageBreakdown.length?<tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No package is assigned to this supplier.</td></tr>:null}</tbody></table></div>
    </section>:null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MoneyCard title="Committed" icon={ShoppingCart} rows={committed} helper={`${pos.length} active PO records`} href="/reports?detail=pos"/><MoneyCard title="Certified" icon={FileCheck2} rows={certified} helper={`${invoices.length} invoice records`} href="/reports?detail=invoices"/><MoneyCard title="Paid" icon={Banknote} rows={paid} helper={`${payments.length} payment records`} href="/reports?detail=payments"/><MoneyCard title="Remaining" icon={ReceiptText} rows={remaining} helper="Committed less paid by currency" href="/reports?detail=remaining"/></div>

    {selectedVendor?<div className="my-5 grid gap-5 xl:grid-cols-2">
      <section className="mccs-card rounded-2xl p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Paid Payment History</h2><p className="mt-1 text-sm text-slate-500">Actual payments made to {selectedVendorName}, including payment date and reference.</p></div><Banknote className="h-5 w-5 text-emerald-600"/></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3 pr-3">Date Paid</th><th className="py-3 pr-3">PO</th><th className="py-3 pr-3">Package</th><th className="py-3 pr-3">Amount</th><th className="py-3">Reference</th></tr></thead><tbody className="divide-y">{paymentHistory.map((p:any)=><tr key={p.id}><td className="py-3 pr-3 font-semibold">{formatDate(p.payment_date)}</td><td className="py-3 pr-3">{pmap.get(String(p.purchase_order_id))?.po_number||"—"}</td><td className="py-3 pr-3">{projectMap.get(String(pmap.get(String(p.purchase_order_id))?.project_id))||"—"}</td><td className="py-3 pr-3 font-bold text-emerald-700">{cMap.get(String(p.currency_id))||""} {Number(p.paid_amount||0).toLocaleString()}</td><td className="py-3">{p.payment_reference||"—"}</td></tr>)}{!paymentHistory.length?<tr><td colSpan={5} className="py-8 text-center text-slate-500">No payments recorded for this supplier yet.</td></tr>:null}</tbody></table></div></section>
      <section className="mccs-card rounded-2xl p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Remaining Payment Schedule</h2><p className="mt-1 text-sm text-slate-500">Upcoming contractual milestones and the date each payment is due.</p></div><CalendarClock className="h-5 w-5 text-blue-700"/></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3 pr-3">Due Date</th><th className="py-3 pr-3">PO</th><th className="py-3 pr-3">Package</th><th className="py-3 pr-3">Milestone</th><th className="py-3">Amount</th></tr></thead><tbody className="divide-y">{upcoming.map((m:any)=>{const p=pmap.get(String(m.purchase_order_id)),amt=Number(m._remaining_amount??(m.percentage!=null?Number(p?.current_value||0)*Number(m.percentage)/100:Number(m.fixed_amount||0))),cur=cMap.get(String(p?.currency_id))||"";return <tr key={m.id}><td className="py-3 pr-3 font-semibold">{formatDate(m.payment_due_date)}</td><td className="py-3 pr-3">{p?.po_number||"—"}</td><td className="py-3 pr-3">{projectMap.get(String(p?.project_id))||"—"}</td><td className="py-3 pr-3">{m.milestone_name||"Milestone"}</td><td className="py-3 font-bold text-blue-700">{cur} {amt.toLocaleString()}</td></tr>})}{!upcoming.length?<tr><td colSpan={5} className="py-8 text-center text-slate-500">No upcoming payment milestone is scheduled.</td></tr>:null}</tbody></table></div></section>
    </div>:null}

    <section className="mccs-card my-5 overflow-hidden rounded-2xl">
      <div className="border-b px-6 py-5 dark:border-slate-800"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><h2 className="text-lg font-bold">Payment Milestones Calendar</h2><p className="mt-1 text-sm text-slate-500">Calendar view of outstanding contractual payment dates. Each badge shows how many milestones fall on that day.</p></div><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">Overdue {overdueCount}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">Due this week {dueThisWeekCount}</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">Due this month {dueThisMonthCount}</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">Next 3 months {nextThreeMonthsCount}</span></div></div></div>
      <div className="grid xl:grid-cols-[220px_minmax(0,1fr)_330px]">
        <div className="border-r p-5 dark:border-slate-800"><div className="text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">Milestone Summary</div><div className="mt-4 space-y-2"><SummaryPill label="Overdue" value={overdueCount} tone="red" href={`/dashboard?${dashboardQuery(selectedVendor,calendarMonth,selectedDay,"overdue")}`} active={summaryKey==="overdue"}/><SummaryPill label="Due This Week" value={dueThisWeekCount} tone="amber" href={`/dashboard?${dashboardQuery(selectedVendor,calendarMonth,selectedDay,"week")}`} active={summaryKey==="week"}/><SummaryPill label="Due This Month" value={dueThisMonthCount} tone="blue" href={`/dashboard?${dashboardQuery(selectedVendor,calendarMonth,selectedDay,"month")}`} active={summaryKey==="month"}/><SummaryPill label="Next 3 Months" value={nextThreeMonthsCount} tone="emerald" href={`/dashboard?${dashboardQuery(selectedVendor,calendarMonth,selectedDay,"three-months")}`} active={summaryKey==="three-months"}/><SummaryPill label="All Outstanding" value={outstandingSorted.length} tone="slate" href={`/dashboard?${dashboardQuery(selectedVendor,calendarMonth,selectedDay,"all")}`} active={summaryKey==="all"}/></div></div>
        <div className="min-w-0 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Link href={`/dashboard?${dashboardQuery(selectedVendor,prevMonth,"")}`} className="rounded-lg border px-3 py-2 text-sm font-bold">‹</Link><Link href={`/dashboard?${dashboardQuery(selectedVendor,nextMonth,"")}`} className="rounded-lg border px-3 py-2 text-sm font-bold">›</Link><div className="ml-2 text-lg font-bold">{monthLabel}</div></div><Link href={`/dashboard?${dashboardQuery(selectedVendor,defaultMonth,todayKey)}`} className="rounded-lg border px-3 py-2 text-xs font-bold">Today</Link></div><div className="grid grid-cols-7 border-l border-t text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:border-slate-800">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=><div key={x} className="border-b border-r py-2 dark:border-slate-800">{x}</div>)}</div><div className="grid grid-cols-7 border-l dark:border-slate-800">{Array.from({length:leadingDays}).map((_,i)=><div key={`lead-${i}`} className="h-24 border-b border-r bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30"/>)}{calendarDays.map(({day,key,items})=>{const isToday=key===todayKey,isSelected=key===selectedDay,hasOverdue=items.some((m:any)=>String(m.payment_due_date)<todayKey);return <Link key={key} href={`/dashboard?${dashboardQuery(selectedVendor,calendarMonth,key)}`} className={`relative h-24 border-b border-r p-2 transition hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/20 ${isSelected?"bg-blue-50 ring-1 ring-inset ring-blue-300 dark:bg-blue-950/20":""}`}><div className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full text-sm font-bold ${isToday?"bg-blue-700 text-white":"text-slate-700 dark:text-slate-200"}`}>{day}</div>{items.length?<div className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-1 text-xs font-extrabold ${hasOverdue?"bg-red-100 text-red-700":items.length>1?"bg-blue-100 text-blue-700":"bg-emerald-100 text-emerald-700"}`}>{items.length}</div>:null}</Link>})}{Array.from({length:trailingDays}).map((_,i)=><div key={`trail-${i}`} className="h-24 border-b border-r bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30"/>)}</div></div>
        <aside className="border-l p-5 dark:border-slate-800"><div className="flex items-center justify-between"><div><div className="text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">Milestones on</div><h3 className="mt-1 font-bold">{selectedDay?formatDate(selectedDay):"Select a date"}</h3></div>{selectedDayMilestones.length?<span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{selectedDayMilestones.length}</span>:null}</div><div className="mt-4 space-y-3">{selectedDayMilestones.map((m:any)=>{const p=pmap.get(String(m.purchase_order_id)),amt=Number(m._remaining_amount||0),cur=cMap.get(String(p?.currency_id))||"",supplier=vmap.get(String(p?.vendor_id))||"Unknown Supplier / Contractor",packageName=projectMap.get(String(p?.project_id))||"—";return <div key={m.id} className="rounded-xl border p-4 dark:border-slate-800"><div className="text-xs font-extrabold uppercase tracking-wide text-blue-700">{supplier}</div><div className="mt-2 font-semibold">{m.milestone_name||"Milestone"}</div><div className="mt-2 space-y-1 text-xs text-slate-500"><div><span className="font-semibold text-slate-600 dark:text-slate-300">Milestone:</span> {m.percentage!=null?`${Number(m.percentage).toLocaleString(undefined,{maximumFractionDigits:2})}%`:Number(p?.current_value||0)>0?`${(Number(m._full_amount||0)/Number(p.current_value)*100).toLocaleString(undefined,{maximumFractionDigits:2})}%`:"—"}</div><div><span className="font-semibold text-slate-600 dark:text-slate-300">Package:</span> {packageName}</div><div><span className="font-semibold text-slate-600 dark:text-slate-300">PO:</span> {p?.po_number||"—"}</div></div><div className="mt-3 flex items-end justify-between gap-3"><div className="text-xs capitalize text-slate-500">{String(m.status||"planned").replaceAll("_"," ")}</div><div className="font-bold text-emerald-700">{cur} {amt.toLocaleString()}</div></div></div>})}{selectedDay&&!selectedDayMilestones.length?<div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">No outstanding payment milestones on this date.</div>:null}{!selectedDay?<div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Select a calendar date to inspect its milestones.</div>:null}</div></aside>
      </div>
    </section>
    {summaryKey?<section id="milestone-summary-list" className="mccs-card my-5 overflow-hidden rounded-2xl"><div className="flex flex-col gap-3 border-b px-6 py-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-bold">{summaryTitle}</h2><p className="mt-1 text-sm text-slate-500">{summaryRows.length} milestone{summaryRows.length===1?"":"s"}. Click another summary KPI to switch the list.</p></div><Link href={`/dashboard?${dashboardQuery(selectedVendor,calendarMonth,selectedDay)}`} className="self-start rounded-lg border px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Close list</Link></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr>{filterDefs.map(([key,label])=><FilterHeader key={key} label={label} options={(filterOptions as any)[key]||[]} current={filterValue(key)} hrefFor={(value:string)=>filterHref(key,value)}/>)}{canEditMilestonePayment?<th className="px-5 py-3">Update</th>:null}</tr></thead><tbody className="divide-y dark:divide-slate-800">{summaryRows.map((m:any)=>{const po=m._po,supplier=m._supplier,packageName=m._package,due=m._due,overdueDays=m._overdue_days,cur=m._currency,pct=m._pct;return <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60"><td className="px-5 py-3 font-bold text-blue-700">{po?.po_number||"—"}</td><td className="px-5 py-3">{supplier}</td><td className="px-5 py-3">{packageName}</td><td className="px-5 py-3 font-semibold">{m.milestone_name||"Milestone"}</td><td className="px-5 py-3">{pct.toLocaleString(undefined,{maximumFractionDigits:2})}%</td><td className="px-5 py-3">{formatDate(due)}</td><td className={`px-5 py-3 font-bold ${overdueDays>0?"text-red-700":"text-slate-500"}`}>{overdueDays>0?`${overdueDays} day${overdueDays===1?"":"s"}`:"—"}</td><td className="px-5 py-3 font-bold">{cur} {Number(m._remaining_amount||0).toLocaleString()}</td><td className="px-5 py-3">{canEditMilestonePayment?<select form={`dashboard-milestone-${m.id}`} name="status" defaultValue={m.status||"planned"} className="min-w-[150px] rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold">{milestoneStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<span className="capitalize">{String(m.status||"planned").replaceAll("_"," ")}</span>}</td><td className="px-5 py-3">{canEditMilestonePayment?<input form={`dashboard-milestone-${m.id}`} name="actual_payment_date" type="date" defaultValue={m.actual_payment_date||""} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"/>:(m.actual_payment_date?formatDate(m.actual_payment_date):"—")}</td>{canEditMilestonePayment?<td className="px-5 py-3"><form id={`dashboard-milestone-${m.id}`} action={updateDashboardMilestone}><input type="hidden" name="milestone_id" value={m.id}/><button className="rounded-lg bg-[#07111f] px-3 py-2 text-xs font-bold text-white">Save</button></form></td>:null}</tr>})}{!summaryRows.length?<tr><td colSpan={canEditMilestonePayment?11:10} className="px-5 py-10 text-center text-slate-500">No milestones match this summary.</td></tr>:null}</tbody></table></div></section>:null}
    <DashboardCharts vendorData={vendorData} statusData={statusData} cashflowData={cashflowData}/>
  </div>;
}

function moneyInline(rows:MoneyRow[]){return rows.length?rows.map(([c,v])=>`${c} ${v.toLocaleString()}`).join(" • "):"—";}
function formatDate(value:string){if(!value)return"—";const d=new Date(`${value}T00:00:00`);return Number.isNaN(d.getTime())?value:d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}
function dashboardQuery(vendor:string,month:string,day:string,summary=""){const p=new URLSearchParams();if(vendor)p.set("vendor",vendor);if(month)p.set("month",month);if(day)p.set("day",day);if(summary)p.set("summary",summary);return p.toString();}
function SummaryPill({label,value,tone,href,active=false}:{label:string;value:number;tone:"red"|"amber"|"blue"|"emerald"|"slate";href:string;active?:boolean}){const styles={red:"bg-red-50 text-red-700",amber:"bg-amber-50 text-amber-700",blue:"bg-blue-50 text-blue-700",emerald:"bg-emerald-50 text-emerald-700",slate:"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"};return <Link href={href} scroll={true} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-sm ${styles[tone]} ${active?"ring-2 ring-blue-500 ring-offset-1":""}`}><span>{label}</span><span>{value}</span></Link>}

function FilterHeader({label,options,current,hrefFor}:{label:string;options:string[];current:string;hrefFor:(value:string)=>string}){return <th className="relative px-5 py-3 align-top"><details className="group"><summary className={`cursor-pointer list-none whitespace-nowrap select-none ${current?"text-blue-700":""}`}>{label} <span className="ml-1 text-[10px]">▾</span></summary><div className="absolute z-40 mt-2 max-h-64 min-w-[190px] overflow-auto rounded-xl border bg-white p-2 text-xs font-semibold normal-case tracking-normal shadow-xl dark:border-slate-700 dark:bg-slate-900"><Link href={hrefFor("")} className={`block rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${!current?"text-blue-700":""}`}>All</Link>{options.map((v)=><Link key={v} href={hrefFor(v)} className={`block whitespace-nowrap rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${current===v?"bg-blue-50 text-blue-700 dark:bg-slate-800":""}`}>{label==="Status"?v.replaceAll("_"," "):label.includes("Date")&&v!=="Not set"?formatDate(v):v}</Link>)}</div></details></th>}

function MiniMetric({title,rows,value,helper,icon:Icon}:{title:string;rows?:MoneyRow[];value?:string;helper?:string;icon:any}){return <div className="rounded-xl border border-white/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">{title}</div><Icon className="h-4 w-4 text-blue-700"/></div>{value?<div className="mt-2 text-xl font-bold">{value}</div>:<div className="mt-2 space-y-1">{(rows||[]).map(([c,v])=><div key={c} className="flex items-baseline justify-between gap-4"><span className="text-xs font-bold text-blue-700">{c}</span><span className="text-lg font-bold">{v.toLocaleString()}</span></div>)}{!(rows||[]).length?<div className="text-lg font-bold">0</div>:null}</div>}{helper?<div className="mt-2 text-[11px] text-slate-500">{helper}</div>:null}</div>}

function MoneyCard({title,rows,helper,icon:Icon,href}:{title:string;rows:MoneyRow[];helper:string;icon:any;href:string}){return <Link href={href} className="mccs-card group block rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"><div className="flex justify-between"><div className="text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-500">{title}</div><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon className="h-5 w-5"/></div></div><div className="mt-3 space-y-1">{rows.slice(0,3).map(([c,v])=><div key={c} className="flex items-baseline justify-between"><span className="text-sm font-bold text-blue-700">{c}</span><span className="text-xl font-bold">{v.toLocaleString()}</span></div>)}{!rows.length?<div className="text-2xl font-bold">0</div>:null}</div><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{helper}</span><span className="font-bold text-blue-700 opacity-0 transition group-hover:opacity-100">View list →</span></div></Link>}
