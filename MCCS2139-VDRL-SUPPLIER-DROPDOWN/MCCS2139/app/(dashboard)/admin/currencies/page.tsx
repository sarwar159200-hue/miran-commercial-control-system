import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page(){
  const supabase = await createClient(); if(!supabase) return null;
  const result = await supabase.from("currencies").select("id,code,name,symbol,decimal_places,is_active").order("code");
  const rows = result.data ?? [];
  return <div className="mx-auto max-w-6xl">
    <div className="flex items-end justify-between"><div><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Administration</div><h1 className="mt-2 text-3xl font-bold">Currencies</h1></div><Link href="/admin/currencies/new" className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white">Add Currency</Link></div>
    <div className="mccs-card mt-7 overflow-hidden rounded-2xl"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Symbol</th><th className="px-5 py-3">Decimals</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y">{rows.map((r:any)=><tr key={r.id}><td className="px-5 py-4 font-bold">{r.code}</td><td className="px-5 py-4">{r.name}</td><td className="px-5 py-4">{r.symbol || "—"}</td><td className="px-5 py-4">{r.decimal_places}</td><td className="px-5 py-4">{r.is_active ? "Active":"Inactive"}</td></tr>)}</tbody></table></div>
  </div>
}