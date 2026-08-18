import Image from "next/image";

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
    <aside className="min-h-screen w-64 shrink-0 bg-slate-950 p-5 text-white">
      <div className="mb-8">
        <div className="rounded-xl bg-white p-3">
          <Image
            src="/miran-energy-logo.png"
            alt="Miran Energy LTD"
            width={250}
            height={80}
            className="h-auto w-full object-contain"
          />
        </div>
        <div className="mt-4 text-xl font-bold">MCCS</div>
        <div className="mt-1 text-xs leading-5 text-slate-400">
          Miran Commercial Control System
        </div>
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
