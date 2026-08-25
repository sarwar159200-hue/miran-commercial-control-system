"use client";

import { RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function VendorDashboardFilter({vendors,selectedVendor}:{vendors:{id:string;name:string}[];selectedVendor:string}){
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const [pending,startTransition]=useTransition();

  function navigate(params:URLSearchParams){
    startTransition(()=>router.replace(`${pathname}${params.toString()?`?${params.toString()}`:""}`,{scroll:false}));
  }

  function changeVendor(value:string){
    const params=new URLSearchParams(searchParams.toString());
    if(value) params.set("vendor",value); else params.delete("vendor");
    navigate(params);
  }

  function resetFilters(){
    // Reset every dashboard URL-driven filter (supplier, calendar month and selected day)
    // so the user always returns to the clean overall dashboard view.
    navigate(new URLSearchParams());
  }

  const hasActiveFilters=Boolean(searchParams.toString());

  return <div className="flex min-w-[300px] flex-col gap-1.5">
    <label htmlFor="dashboard-vendor" className="text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-500">Supplier / Contractor</label>
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <select id="dashboard-vendor" value={selectedVendor} onChange={(e)=>changeVendor(e.target.value)} disabled={pending} className="input w-full bg-white pr-10 font-semibold dark:bg-slate-900">
          <option value="">All Suppliers & Contractors</option>
          {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        {pending?<span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-xs text-blue-600">Loading…</span>:null}
      </div>
      <button
        type="button"
        onClick={resetFilters}
        disabled={pending || !hasActiveFilters}
        title="Reset dashboard filters"
        className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-950/30"
      >
        <RotateCcw className="h-4 w-4" />
        <span className="hidden 2xl:inline">Reset</span>
      </button>
    </div>
  </div>;
}
