import { KpiCard } from "@/components/kpi-card";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-7">
        <div className="text-sm text-slate-500">Miran Energy • MCCS</div>
        <h1 className="text-3xl font-bold text-slate-950">Commercial Executive Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Committed" value="—" helper="Current PO / contract value" />
        <KpiCard label="Certified" value="—" helper="Approved for payment" />
        <KpiCard label="Paid" value="—" helper="Confirmed actual payments" />
        <KpiCard label="Remaining" value="—" helper="Unspent commitment" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="min-h-72 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Upcoming Payment Milestones</h2>
          <p className="mt-2 text-sm text-slate-500">
            Package 02 will connect live milestone dates, due dates and payment values.
          </p>
        </section>
        <section className="min-h-72 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Vendor Exposure</h2>
          <p className="mt-2 text-sm text-slate-500">
            Parent and sub-vendor rollups will be calculated from the vendor hierarchy.
          </p>
        </section>
      </div>
    </div>
  );
}
