import Link from "next/link";
import {
  amendPurchaseOrder,
  holdPurchaseOrder,
  releasePurchaseOrder,
  softDeletePurchaseOrder,
} from "../../_actions/commercial";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; warning?: string }>;
}) {
  const { id } = await params;
  const qs = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;

  const poResult = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (poResult.error) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-bold text-red-800">PO could not be loaded</h1>
          <p className="mt-2 text-sm text-red-700">{poResult.error.message}</p>
          <Link href="/purchase-orders" className="mt-4 inline-block font-bold text-blue-700">
            Back to PO Register
          </Link>
        </div>
      </div>
    );
  }

  const po = poResult.data;

  if (!po) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-bold text-amber-900">PO not found</h1>
          <p className="mt-2 text-sm text-amber-800">
            No Purchase Order record was returned for ID: {id}
          </p>
          <Link href="/purchase-orders" className="mt-4 inline-block font-bold text-blue-700">
            Back to PO Register
          </Link>
        </div>
      </div>
    );
  }

  const [vendorResult, currencyResult, projectResult, revResult, milestoneResult] =
    await Promise.all([
      po.vendor_id
        ? supabase.from("vendors").select("vendor_name").eq("id", po.vendor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      po.currency_id
        ? supabase.from("currencies").select("code").eq("id", po.currency_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      po.project_id
        ? supabase.from("projects").select("project_code,project_name").eq("id", po.project_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      supabase
        .from("po_revisions")
        .select("*")
        .eq("purchase_order_id", id)
        .order("revision_date", { ascending: false }),
      supabase
        .from("payment_milestones")
        .select("*")
        .eq("purchase_order_id", id)
        .order("sequence_no"),
    ]);

  const revisions = revResult.data ?? [];
  const milestones = milestoneResult.data ?? [];
  const vendorName = vendorResult.data?.vendor_name || "—";
  const currencyCode = currencyResult.data?.code || "";
  const projectName = projectResult.data
    ? `${projectResult.data.project_code} — ${projectResult.data.project_name}`
    : "—";

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
            Purchase Order
          </div>
          <h1 className="mt-2 text-3xl font-bold">{po.po_number}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {vendorName} • {currencyCode} {Number(po.current_value || 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400">Project: {projectName}</p>
        </div>
        <div className="flex gap-3"><Link href={`/purchase-orders/${id}/edit`} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold text-blue-700">Edit PO</Link><Link href="/purchase-orders" className="rounded-xl px-4 py-2.5 text-sm font-bold text-blue-700">Back to register</Link></div>
      </div>

      {qs.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {qs.error}
        </div>
      ) : null}

      {qs.warning ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {qs.warning}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <K l="Current Value" v={`${currencyCode} ${Number(po.current_value || 0).toLocaleString()}`} />
        <K l="Status" v={po.status} />
        <K l="Revisions" v={String(revisions.length)} />
        <K l="Milestones" v={String(milestones.length)} />
      </div>

      {po.status === "on_hold" ? (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          ON HOLD — {po.hold_reason || "No reason recorded"}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="mccs-card rounded-2xl p-6">
          <h2 className="text-lg font-bold">Amend PO</h2>
          <form action={amendPurchaseOrder} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="po_id" value={id} />
            <input name="revision_no" required className="input" placeholder="Revision e.g. Rev 1" />
            <input name="revision_date" type="date" className="input" />
            <input name="value_change" className="input" placeholder="Value change (+/-)" />
            <input name="reason" required className="input md:col-span-2" placeholder="Reason for amendment" />
            <button className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white md:col-span-2">
              Save Amendment
            </button>
          </form>
        </section>

        <section className="mccs-card rounded-2xl p-6">
          <h2 className="text-lg font-bold">PO Controls</h2>
          {po.status === "on_hold" ? (
            <form action={releasePurchaseOrder} className="mt-4">
              <input type="hidden" name="po_id" value={id} />
              <button className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">
                Release Hold
              </button>
            </form>
          ) : (
            <form action={holdPurchaseOrder} className="mt-4">
              <input type="hidden" name="po_id" value={id} />
              <input name="hold_reason" required className="input" placeholder="Reason for hold" />
              <button className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white">
                Place PO on Hold
              </button>
            </form>
          )}

          <form action={softDeletePurchaseOrder} className="mt-4">
            <input type="hidden" name="po_id" value={id} />
            <button className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              Archive / Delete PO
            </button>
          </form>

          <p className="mt-2 text-xs text-slate-500">
            Deletion is soft-delete for auditability; the record is retained in the database.
          </p>
        </section>
      </div>

      <section className="mccs-card mt-6 rounded-2xl p-6">
        <h2 className="text-lg font-bold">Payment Milestones</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3">%</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Payment Due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {milestones.map((m: any) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-bold">{m.milestone_name}</td>
                  <td className="px-4 py-3">{m.percentage ?? "—"}</td>
                  <td className="px-4 py-3">
                    {m.fixed_amount ? Number(m.fixed_amount).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">{m.planned_due_date || "—"}</td>
                  <td className="px-4 py-3">{m.payment_due_date || "—"}</td>
                  <td className="px-4 py-3 capitalize">{m.status}</td>
                </tr>
              ))}
              {!milestones.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No milestones recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mccs-card mt-6 rounded-2xl p-6">
        <h2 className="text-lg font-bold">Revision History</h2>
        <div className="mt-4 space-y-2">
          {revisions.map((r: any) => (
            <div key={r.id} className="rounded-xl border bg-white p-4">
              <div className="flex justify-between gap-4">
                <b>{r.revision_no}</b>
                <span className="text-sm text-slate-500">{r.revision_date || "—"}</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">{r.reason}</div>
              <div className="mt-1 text-xs font-bold text-blue-700">
                Value change: {Number(r.value_change || 0).toLocaleString()}
              </div>
            </div>
          ))}
          {!revisions.length ? (
            <div className="text-sm text-slate-500">No amendments yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function K({ l, v }: { l: string; v: string }) {
  return (
    <div className="mccs-card rounded-2xl p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{l}</div>
      <div className="mt-2 text-2xl font-bold capitalize">{v}</div>
    </div>
  );
}
