import Link from "next/link";
import { createPurchaseOrder } from "../../_actions/commercial";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const [vendorsResult, currenciesResult, projectsResult] = await Promise.all([
    supabase.from("vendors").select("id,vendor_name,parent_vendor_id").eq("is_active", true).order("vendor_name"),
    supabase.from("currencies").select("id,code,name").eq("is_active", true).order("code"),
    supabase.from("projects").select("id,project_code,project_name").eq("is_active", true).order("project_name"),
  ]);

  const vendors = vendorsResult.data ?? [];
  const currencies = currenciesResult.data ?? [];
  const projects = projectsResult.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Purchase Order</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Create New Purchase Order</h1>
          <p className="mt-2 text-sm text-slate-500">Supports both new and pre-system historical approved POs.</p>
        </div>
        <Link href="/purchase-orders" className="text-sm font-bold text-blue-700">Back to PO Register</Link>
      </div>

      <form action={createPurchaseOrder} className="mccs-card mt-7 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-950">Commercial Information</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="PO Number *"><input name="po_number" required className="input" /></Field>
          <Field label="PO Date *"><input name="po_date" type="date" required className="input" /></Field>
          <Field label="Vendor *">
            <select name="vendor_id" required className="input">
              <option value="">Select vendor</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
          </Field>
          <Field label="Parent Contractor">
            <select name="parent_contractor_id" className="input">
              <option value="">None / Direct</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select name="project_id" className="input">
              <option value="">Select project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>)}
            </select>
          </Field>
          <Field label="Currency *">
            <select name="currency_id" required className="input">
              <option value="">Select currency</option>
              {currencies.map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </Field>
          <Field label="Original PO Value *"><input name="original_value" inputMode="decimal" required className="input" placeholder="0.00" /></Field>
          <Field label="Approved Variations"><input name="approved_variations" inputMode="decimal" className="input" placeholder="0.00" /></Field>
          <Field label="Status">
            <select name="status" className="input">
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="PR Number"><input name="pr_number" className="input" /></Field>
          <Field label="RFQ Number"><input name="rfq_number" className="input" /></Field>
          <Field label="Approval Date"><input name="approval_date" type="date" className="input" /></Field>
          <Field label="Approved By"><input name="approved_by_text" className="input" /></Field>
          <Field label="Delivery Due Date"><input name="delivery_due_date" type="date" className="input" /></Field>
          <Field label="Delivery Terms"><input name="delivery_terms" className="input" placeholder="e.g. DDP Miran Site" /></Field>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Payment Terms"><textarea name="payment_terms" rows={4} className="input" /></Field>
          <Field label="Notes"><textarea name="notes" rows={4} className="input" /></Field>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <label className="flex items-center gap-3 font-bold text-amber-900">
            <input type="checkbox" name="is_historical" className="h-4 w-4" />
            Historical / approved before MCCS go-live
          </label>
          <input name="historical_source" className="input mt-4" placeholder="Historical evidence / source reference" />
        </div>

        <div className="mt-7 flex justify-end gap-3">
          <Link href="/purchase-orders" className="rounded-xl border px-5 py-3 text-sm font-bold text-slate-700">Cancel</Link>
          <button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white">Create Purchase Order</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>{children}</label>;
}
