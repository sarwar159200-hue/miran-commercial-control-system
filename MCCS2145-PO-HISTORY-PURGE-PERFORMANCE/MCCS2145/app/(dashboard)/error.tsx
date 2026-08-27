"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-600">
        MCCS Error
      </div>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">
        This action could not be completed
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {error.message || "An unexpected server error occurred."}
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
      ) : null}
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
      >
        Try again
      </button>
    </div>
  );
}
