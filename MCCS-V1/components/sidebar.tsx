const items = [
  "Dashboard",
  "Vendors",
  "Purchase Orders",
  "Payment Milestones",
  "Invoices",
  "Payments",
  "Documents",
  "Reports",
  "Administration",
];

export function Sidebar() {
  return (
    <aside className="min-h-screen w-64 bg-slate-950 text-white p-5">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Miran Energy</div>
        <div className="mt-1 text-xl font-semibold">MCCS</div>
        <div className="mt-1 text-xs text-slate-400">Commercial Control System</div>
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            {item}
          </div>
        ))}
      </nav>
    </aside>
  );
}
