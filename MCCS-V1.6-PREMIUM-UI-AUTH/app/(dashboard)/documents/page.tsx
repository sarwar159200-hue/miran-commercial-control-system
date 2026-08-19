export default function Page() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">MCCS</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Documents</h1>
      <p className="mt-2 text-sm text-slate-500">Commercial document index with OneDrive-backed storage.</p>
      <div className="mccs-card mt-7 rounded-2xl p-8">
        <div className="text-sm font-bold text-slate-700">Module ready for live data connection</div>
        <div className="mt-2 text-sm text-slate-500">The next functional package will connect this module to Supabase and the approval workflow.</div>
      </div>
    </div>
  );
}
