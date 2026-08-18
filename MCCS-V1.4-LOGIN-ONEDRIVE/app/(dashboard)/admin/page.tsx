import Link from "next/link";

const cards = [
  "Users & Roles",
  "Vendors",
  "Currencies",
  "Projects",
  "Disciplines",
  "WBS / Cost Codes",
  "Payment Milestone Templates",
  "Historical Import",
  "Audit Log",
];

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Administration</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((x) => (
          <div key={x} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="font-semibold">{x}</div>
          </div>
        ))}

        <Link
          href="/admin/onedrive"
          className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition hover:bg-blue-100"
        >
          <div className="font-semibold text-blue-950">OneDrive Configuration</div>
          <div className="mt-2 text-sm text-blue-700">
            Microsoft Graph storage connection status
          </div>
        </Link>
      </div>
    </div>
  );
}
