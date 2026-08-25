"use client";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function GlobalSearch(){
  const router=useRouter(); const pathname=usePathname(); const params=useSearchParams();
  const [q,setQ]=useState(pathname==="/search" ? (params.get("q")||"") : "");
  function submit(e:FormEvent){e.preventDefault(); const v=q.trim(); if(v) router.push(`/search?q=${encodeURIComponent(v)}`);}
  return <form onSubmit={submit} className="hidden min-w-[260px] max-w-[520px] flex-1 lg:flex">
    <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-blue-400 focus-within:bg-white">
      <Search className="h-4 w-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search PO, RFQ, vendor, invoice, payment, package..."/>
    </div>
  </form>
}
