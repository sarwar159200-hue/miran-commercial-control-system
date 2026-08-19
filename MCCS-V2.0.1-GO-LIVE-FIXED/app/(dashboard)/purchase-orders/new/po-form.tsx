"use client";
import { useState } from "react";
import Link from "next/link";
import { createPurchaseOrder } from "../../_actions/commercial";

export function POForm({vendors,currencies,projects,error}:{vendors:any[];currencies:any[];projects:any[];error?:string}) {
  const [milestones,setMilestones]=useState([{name:"",percentage:"",amount:"",due:"",paymentDue:"",discipline:""}]);
  const add=()=>setMilestones([...milestones,{name:"",percentage:"",amount:"",due:"",paymentDue:"",discipline:""}]);
  const remove=(i:number)=>setMilestones(milestones.filter((_,idx)=>idx!==i));
  const update=(i:number,key:string,value:string)=>setMilestones(milestones.map((m,idx)=>idx===i?{...m,[key]:value}:m));
  const allocated=milestones.reduce((s,m)=>s+(Number(m.percentage)||0),0);

  return <form action={createPurchaseOrder} className="mccs-card mt-7 rounded-2xl p-6">
    {error?<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>:null}
    <h2 className="text-lg font-bold">Commercial Information</h2>
    <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      <F l="PO Number *"><input name="po_number" required className="input"/></F>
      <F l="PO Date *"><input name="po_date" type="date" required className="input"/></F>
      <F l="Vendor *"><select name="vendor_id" required className="input"><option value="">Select vendor</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.vendor_name}</option>)}</select></F>
      <F l="Parent Contractor"><select name="parent_contractor_id" className="input"><option value="">None / Direct</option>{vendors.filter(v=>!v.parent_vendor_id).map(v=><option key={v.id} value={v.id}>{v.vendor_name}</option>)}</select></F>
      <F l="Project"><select name="project_id" className="input"><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>)}</select></F>
      <F l="Currency *"><select name="currency_id" required className="input"><option value="">Select currency</option>{currencies.map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></F>
      <F l="Original PO Value *"><input name="original_value" required inputMode="decimal" className="input"/></F>
      <F l="Status"><select name="status" className="input"><option value="active">Active</option><option value="draft">Draft</option><option value="completed">Completed</option><option value="closed">Closed</option></select></F>
      <F l="PR Number"><input name="pr_number" className="input"/></F>
      <F l="RFQ Number"><input name="rfq_number" className="input"/></F>
      <F l="Approval Date"><input name="approval_date" type="date" className="input"/></F>
      <F l="Approved By"><input name="approved_by_text" className="input"/></F>
      <F l="Delivery Due Date"><input name="delivery_due_date" type="date" className="input"/></F>
      <F l="Delivery Terms"><input name="delivery_terms" className="input"/></F>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><F l="Payment Terms"><textarea name="payment_terms" rows={3} className="input"/></F><F l="Notes"><textarea name="notes" rows={3} className="input"/></F></div>
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><label className="font-bold text-amber-900"><input type="checkbox" name="is_historical" className="mr-2"/>Historical / approved before MCCS</label><input name="historical_source" className="input mt-3" placeholder="Evidence/source reference"/></div>

    <div className="mt-8 flex items-end justify-between"><div><h2 className="text-lg font-bold">Payment Milestones</h2><p className="text-sm text-slate-500">Add milestones now or later from the PO detail page.</p></div><button type="button" onClick={add} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">+ Add Milestone</button></div>
    <input type="hidden" name="milestone_count" value={milestones.length}/>
    <div className="mt-4 space-y-3">{milestones.map((m,i)=><div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"><input name={`milestone_name_${i}`} value={m.name} onChange={e=>update(i,"name",e.target.value)} className="input lg:col-span-2" placeholder="Milestone name"/><input name={`milestone_percentage_${i}`} value={m.percentage} onChange={e=>update(i,"percentage",e.target.value)} className="input" placeholder="%"/><input name={`milestone_amount_${i}`} value={m.amount} onChange={e=>update(i,"amount",e.target.value)} className="input" placeholder="Fixed amount"/><input name={`milestone_due_${i}`} value={m.due} onChange={e=>update(i,"due",e.target.value)} type="date" className="input"/><input name={`milestone_payment_due_${i}`} value={m.paymentDue} onChange={e=>update(i,"paymentDue",e.target.value)} type="date" className="input"/><input name={`milestone_discipline_${i}`} value={m.discipline} onChange={e=>update(i,"discipline",e.target.value)} className="input lg:col-span-2" placeholder="Discipline / verifier"/>{milestones.length>1?<button type="button" onClick={()=>remove(i)} className="text-left text-sm font-bold text-red-600">Remove</button>:null}</div></div>)}</div>
    <div className={`mt-4 text-sm font-bold ${allocated>100?"text-red-600":"text-slate-600"}`}>Allocated milestone percentage: {allocated.toFixed(2)}%</div>
    <div className="mt-7 flex justify-end gap-3"><Link href="/purchase-orders" className="rounded-xl border px-5 py-3 text-sm font-bold">Cancel</Link><button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white">Create PO & Milestones</button></div>
  </form>
}
function F({l,children}:{l:string;children:React.ReactNode}){return <label><span className="mb-2 block text-sm font-bold text-slate-700">{l}</span>{children}</label>}
