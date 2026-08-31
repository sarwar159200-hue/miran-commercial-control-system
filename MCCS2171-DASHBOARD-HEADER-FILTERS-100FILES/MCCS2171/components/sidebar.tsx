"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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
  MessageCircle,
  ClipboardList,
  Smartphone,
} from "lucide-react";

const items = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: Gauge },
  { key: "vendors", label: "Vendors", href: "/vendors", icon: Building2 },
  { key: "projects", label: "Projects & Packages", href: "/projects", icon: BriefcaseBusiness },
  { key: "purchase_orders", label: "Purchase Orders", href: "/purchase-orders", icon: FileText },
  { key: "payment_milestones", label: "Payment Milestones", href: "/payment-milestones", icon: CalendarClock },
  { key: "invoices", label: "Invoices", href: "/invoices", icon: FileCheck2 },
  { key: "payments", label: "Payments", href: "/payments", icon: CreditCard },
  { key: "vdrl", label: "VDRL", href: "/vdrl", icon: ClipboardList },
  { key: "documents", label: "Documents", href: "/documents", icon: Landmark },
  { key: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
  { key: "messages", label: "Messages", href: "/messages", icon: MessageCircle },
];

export function Sidebar({ canAdmin = false, allowedTabs = [] }: { canAdmin?: boolean; allowedTabs?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = new Set(allowedTabs);
  const baseItems = allowedTabs.length ? items.filter((item)=>allowed.has(item.key)) : items;
  const visibleItems = canAdmin && (!allowedTabs.length || allowed.has("administration"))
    ? [...baseItems, { key: "administration", label: "Administration", href: "/admin", icon: Settings }]
    : baseItems;
  const navigationItems = [...visibleItems, { key: "mobile_app", label: "Android App", href: "/mobile-app", icon: Smartphone }];

  // Warm the main routes only after the first screen is usable. This keeps sign-in
  // responsive while making subsequent sidebar changes feel much faster.
  useEffect(() => {
    const warm = () => navigationItems.forEach((item) => router.prefetch(item.href));
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm);
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 800);
    return () => window.clearTimeout(id);
  // navigationItems is derived from stable permission props for the life of this layout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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
        {navigationItems.map(({ label, href, icon: Icon }) => {
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
