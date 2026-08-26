import Link from "next/link";
import {
  amendPurchaseOrder,
  holdPurchaseOrder,
  releasePurchaseOrder,
  softDeletePurchaseOrder,
  addPurchaseOrderItem,
  deletePurchaseOrderItem,
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

  const { data: { user } } = await supabase.auth.getUser();
  const [vendorResult, currencyResult, projectResult, revResult, milestoneResult, itemResult, meResult] =
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
      supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id).order("sequence_no"),
      user ? supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle() : Promise.resolve({data:null} as any),
    ]);

  const revisions = revResult.data ?? [];
  const milestones = milestoneResult.data ?? [];
  const items = itemResult.data ?? [];
  const isSuperAdmin = Boolean(meResult.data?.is_super_admin);
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
        <div className="flex flex-wrap gap-3"><a href={`/api/purchase-orders/${id}/pdf`} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Export Miran PO PDF</a><Link href={`/documents/upload?po=${id}`} className="rounded-xl bg-[#07111f] px-4 py-2.5 text-sm font-bold text-white dark:bg-blue-600">Attach Document</Link>{isSuperAdmin?<Link href={`/purchase-orders/${id}/edit`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">Edit PO & Milestones</Link>:null}<Link href="/purchase-orders" className="rounded-xl px-4 py-2.5 text-sm font-bold text-blue-700">Back to register</Link></div>
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
          {!isSuperAdmin ? <p className="mt-3 text-sm text-slate-500">Only a Super Admin can hold, release or delete a PO.</p> : null}
          {isSuperAdmin ? <>
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

          <form action={softDeletePurchaseOrder} className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <input type="hidden" name="po_id" value={id} />
            <input name="delete_reason" required className="input" placeholder="Reason for deleting / cancelling this PO"/>
            <button className="mt-3 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white">Delete PO</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Audit-safe soft deletion: hidden from active registers but retained in history.</p>
          </> : null}
        </section>
      </div>

      <section className="mccs-card mt-6 rounded-2xl p-6">
        <div className="flex items-end justify-between"><div><h2 className="text-lg font-bold">PO Items / Description</h2><p className="mt-1 text-sm text-slate-500">Editable line items used in the Miran PO PDF export.</p></div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Site</th><th className="px-3 py-2">UOM</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Unit Cost</th><th className="px-3 py-2">Total</th><th></th></tr></thead><tbody className="divide-y">{items.map((it:any)=><tr key={it.id}><td className="px-3 py-3">{it.item_code||"—"}</td><td className="px-3 py-3 font-semibold">{it.description}</td><td className="px-3 py-3">{it.site||"—"}</td><td className="px-3 py-3">{it.uom||"—"}</td><td className="px-3 py-3">{Number(it.quantity||0).toLocaleString()}</td><td className="px-3 py-3">{Number(it.unit_cost||0).toLocaleString()}</td><td className="px-3 py-3 font-bold">{(Number(it.quantity||0)*Number(it.unit_cost||0)).toLocaleString()}</td><td className="px-3 py-3">{isSuperAdmin?<form action={deletePurchaseOrderItem}><input type="hidden" name="po_id" value={id}/><input type="hidden" name="item_id" value={it.id}/><button className="font-bold text-red-700">Delete</button></form>:null}</td></tr>)}{!items.length?<tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No PO items yet.</td></tr>:null}</tbody></table></div>
        {isSuperAdmin?<form action={addPurchaseOrderItem} className="mt-5 grid gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-3"><input type="hidden" name="po_id" value={id}/><input name="item_code" className="input" placeholder="Item code"/><input name="site" className="input" defaultValue="MEL" placeholder="Site"/><input name="uom" className="input" defaultValue="Each" placeholder="UOM"/><textarea name="description" required rows={2} className="input md:col-span-2" placeholder="Item / description"/><input name="quantity" className="input" defaultValue="1" placeholder="Quantity"/><input name="unit_cost" className="input" placeholder="Unit cost"/><button className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white">Add PO Item</button></form>:null}
      </section>

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
