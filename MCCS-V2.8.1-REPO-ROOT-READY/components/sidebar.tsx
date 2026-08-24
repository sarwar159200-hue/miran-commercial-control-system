"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  FileCheck2,
  FileText,
  Gauge,
  Landmark,
  BriefcaseBusiness,
  Settings,
} from "lucide-react";

const items = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Vendors", href: "/vendors", icon: Building2 },
  { label: "Projects & Packages", href: "/projects", icon: BriefcaseBusiness },
  { label: "Purchase Orders", href: "/purchase-orders", icon: FileText },
  { label: "Payment Milestones", href: "/payment-milestones", icon: CalendarClock },
  { label: "Invoices", href: "/invoices", icon: FileCheck2 },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Documents", href: "/documents", icon: Landmark },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Administration", href: "/admin", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="min-h-screen w-[270px] shrink-0 bg-[#07111f] p-5 text-white">
      <div className="rounded-2xl border border-white/10 bg-white p-3">
        <Image
          src="/miran-energy-logo.png"
          alt="Miran Energy LTD"
          width={250}
          height={80}
          className="h-auto w-full object-contain"
        />
      </div>

      <div className="mt-5 px-2">
        <div className="text-lg font-extrabold tracking-tight">MCCS</div>
        <div className="mt-1 text-xs leading-5 text-slate-400">
          Miran Commercial Control System
        </div>
      </div>

      <nav className="mt-7 space-y-1.5">
        {items.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-white text-slate-950 shadow-lg shadow-black/10"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${active ? "text-blue-700" : "text-slate-400"}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Environment
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Production
        </div>
      </div>
    </aside>
  );
}
