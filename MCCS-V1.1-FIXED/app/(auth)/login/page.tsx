export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Miran Energy</div>
        <h1 className="mt-2 text-2xl font-bold">MCCS</h1>
        <p className="mt-1 text-sm font-medium text-slate-700">Miran Commercial Control System</p>
        <p className="mt-2 text-sm text-slate-500">Contracts • Commitments • Invoices • Payments</p>
        <div className="mt-6 space-y-4">
          <input className="w-full rounded-lg border p-3" placeholder="Email" />
          <input className="w-full rounded-lg border p-3" type="password" placeholder="Password" />
          <button className="w-full rounded-lg bg-slate-950 p-3 font-semibold text-white">
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
