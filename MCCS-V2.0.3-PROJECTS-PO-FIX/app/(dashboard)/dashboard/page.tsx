import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  FileCheck2,
  ReceiptText,
} from "lucide-react";

const kpis = [
  { label: "Committed", value: "—", helper: "Current PO / contract value", icon: CircleDollarSign },
  { label: "Certified", value: "—", helper: "Approved for payment", icon: FileCheck2 },
  { label: "Paid", value: "—", helper: "Confirmed actual payments", icon: Banknote },
  { label: "Remaining", value: "—", helper: "Unspent commitment", icon: ReceiptText },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
            Miran Energy • MCCS
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Commercial Executive Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Live commercial position across commitments, milestones, invoices and payments.
          </p>
        </div>

        <div className="flex gap-2">
          <a href="/api/export/commercial" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm">Export Excel</a>
          <Link href="/purchase-orders/new" className="flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-2.5 text-sm font-bold text-white shadow-sm">
            New Purchase Order
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, helper, icon: Icon }) => (
          <div key={label} className="mccs-card rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-500">
                  {label}
                </div>
                <div className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</div>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500">{helper}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="mccs-card min-h-[360px] rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Upcoming Payment Milestones</h2>
              <p className="mt-1 text-sm text-slate-500">
                Payment obligations and due-date exposure will appear here.
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
              <CalendarClock className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-12 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                <CalendarClock className="h-5 w-5 text-blue-700" />
              </div>
              <div className="mt-4 text-sm font-bold text-slate-700">No milestone data yet</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                Add purchase orders and payment milestones to populate this view automatically.
              </div>
            </div>
          </div>
        </section>

        <section className="mccs-card min-h-[360px] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-950">Vendor Exposure</h2>
          <p className="mt-1 text-sm text-slate-500">
            Parent and sub-vendor commercial exposure.
          </p>

          <div className="mt-12 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                <CircleDollarSign className="h-5 w-5 text-blue-700" />
              </div>
              <div className="mt-4 text-sm font-bold text-slate-700">No vendor data yet</div>
              <div className="mt-1 text-xs text-slate-500">
                Vendor roll-ups will calculate automatically.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
