export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Administration</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          "Users & Roles",
          "Vendors",
          "Currencies",
          "Projects",
          "Disciplines",
          "WBS / Cost Codes",
          "Payment Milestone Templates",
          "Historical Import",
          "Audit Log",
        ].map((x) => (
          <div key={x} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="font-semibold">{x}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
