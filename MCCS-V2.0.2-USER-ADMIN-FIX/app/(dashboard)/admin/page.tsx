import Link from "next/link";
import { Activity, Cloud, Coins, Network, Users } from "lucide-react";

const cards = [
  { title: "Users & Roles", sub: "Create team accounts and assign access", href: "/admin/users", icon: Users },
  { title: "Vendors", sub: "Vendor hierarchy", href: "/vendors", icon: Network },
  { title: "Currencies", sub: "Add and manage currencies", href: "/admin/currencies", icon: Coins },
  { title: "OneDrive Configuration", sub: "Microsoft Graph storage status", href: "/admin/onedrive", icon: Cloud },
  { title: "Super Admin Control Center", sub: "Online users and action log", href: "/admin/control-center", icon: Activity },
];

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">MCCS</div>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Administration</h1>
      <p className="mt-2 text-sm text-slate-500">Commercial masters, access governance and system configuration.</p>

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ title, sub, href, icon: Icon }) => (
          <Link key={title} href={href} className="mccs-card rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></div>
            <div className="mt-4 font-bold text-slate-950">{title}</div>
            <div className="mt-1 text-sm text-slate-500">{sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
