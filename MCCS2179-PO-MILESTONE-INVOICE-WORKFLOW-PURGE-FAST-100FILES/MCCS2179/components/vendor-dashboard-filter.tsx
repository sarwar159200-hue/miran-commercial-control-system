"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function VendorDashboardFilter({vendors,selectedVendor}:{vendors:{id:string;name:string}[];selectedVendor:string}){
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const [pending,startTransition]=useTransition();

  function changeVendor(value:string){
    const params=new URLSearchParams(searchParams.toString());
    if(value) params.set("vendor",value); else params.delete("vendor");
    startTransition(()=>router.replace(`${pathname}${params.toString()?`?${params.toString()}`:""}`,{scroll:false}));
  }

  return <div className="flex min-w-[300px] flex-col gap-1.5">
    <label htmlFor="dashboard-vendor" className="text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-500">Supplier / Contractor</label>
    <div className="relative">
      <select id="dashboard-vendor" value={selectedVendor} onChange={(e)=>changeVendor(e.target.value)} disabled={pending} className="input w-full bg-white pr-10 font-semibold dark:bg-slate-900">
        <option value="">All Suppliers & Contractors</option>
        {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      {pending?<span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-xs text-blue-600">Loading…</span>:null}
    </div>
  </div>;
}


export function PurchaseOrderRegisterFilters({
  purchaseOrders,
  vendors,
  selectedPo,
  selectedVendor,
}:{
  purchaseOrders:{id:string;poNumber:string;packageName:string}[];
  vendors:{id:string;name:string}[];
  selectedPo:string;
  selectedVendor:string;
}){
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const [pending,startTransition]=useTransition();

  function changeFilter(key:"po"|"vendor",value:string){
    const params=new URLSearchParams(searchParams.toString());
    if(value) params.set(key,value); else params.delete(key);
    // Filters are register-only. Preserve history/view state but avoid stale audit selection.
    params.delete("history");
    startTransition(()=>router.replace(`${pathname}${params.toString()?`?${params.toString()}`:""}`,{scroll:false}));
  }

  return <div className="flex flex-wrap items-end gap-3">
    <div className="flex min-w-[360px] flex-col gap-1.5">
      <label htmlFor="po-register-po" className="text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-500">PO Number / Package</label>
      <select
        id="po-register-po"
        value={selectedPo}
        onChange={(e)=>changeFilter("po",e.target.value)}
        disabled={pending}
        className="input w-full bg-white font-semibold dark:bg-slate-900"
      >
        <option value="">All Purchase Orders / Packages</option>
        {purchaseOrders.map(po=><option key={po.id} value={po.id}>{po.poNumber} — {po.packageName}</option>)}
      </select>
    </div>
    <div className="flex min-w-[300px] flex-col gap-1.5">
      <label htmlFor="po-register-vendor" className="text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-500">Supplier / Contractor</label>
      <select
        id="po-register-vendor"
        value={selectedVendor}
        onChange={(e)=>changeFilter("vendor",e.target.value)}
        disabled={pending}
        className="input w-full bg-white font-semibold dark:bg-slate-900"
      >
        <option value="">All Suppliers / Contractors</option>
        {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
    </div>
    {(selectedPo||selectedVendor)?<button
      type="button"
      disabled={pending}
      onClick={()=>{
        const params=new URLSearchParams(searchParams.toString());
        params.delete("po"); params.delete("vendor"); params.delete("history");
        startTransition(()=>router.replace(`${pathname}${params.toString()?`?${params.toString()}`:""}`,{scroll:false}));
      }}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >Clear filters</button>:null}
    {pending?<span className="pb-3 text-xs font-semibold text-blue-600">Updating…</span>:null}
  </div>;
}
