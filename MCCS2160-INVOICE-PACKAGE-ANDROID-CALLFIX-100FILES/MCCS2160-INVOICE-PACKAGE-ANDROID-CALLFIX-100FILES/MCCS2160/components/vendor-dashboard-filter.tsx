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
