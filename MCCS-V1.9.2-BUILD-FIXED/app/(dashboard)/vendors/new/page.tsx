import Link from "next/link";
import { createVendor } from "../../_actions/commercial";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewVendorPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const [vendorsResult, currenciesResult] = await Promise.all([
    supabase.from("vendors").select("id,vendor_name").order("vendor_name"),
    supabase.from("currencies").select("id,code,name").eq("is_active", true).order("code"),
  ]);

  const vendors = vendorsResult.data ?? [];
  const currencies = currenciesResult.data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Vendor Master</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Add Vendor / Sub-Vendor</h1>
          <p className="mt-2 text-sm text-slate-500">Leave Parent Vendor blank for a main vendor.</p>
        </div>
        <Link href="/vendors" className="text-sm font-bold text-blue-700">Back to Vendors</Link>
      </div>

      <form action={createVendor} className="mccs-card mt-7 rounded-2xl p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Vendor Name *"><input name="vendor_name" required className="input" /></Field>
          <Field label="Vendor Code"><input name="vendor_code" className="input" placeholder="e.g. ILF" /></Field>
          <Field label="Legal Name"><input name="legal_name" className="input" /></Field>
          <Field label="Parent Vendor">
            <select name="parent_vendor_id" className="input">
              <option value="">Main Vendor / No Parent</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
          </Field>
          <Field label="Relationship Type">
            <select name="relationship_type" className="input">
              <option value="direct_contractor">Direct Contractor</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="supplier">Supplier</option>
              <option value="consultant">Consultant</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="service_provider">Service Provider</option>
            </select>
          </Field>
          <Field label="Default Currency">
            <select name="default_currency_id" className="input">
              <option value="">Select currency</option>
              {currencies.map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </Field>
          <Field label="Country"><input name="country" className="input" /></Field>
          <Field label="Contact Person"><input name="contact_person" className="input" /></Field>
          <Field label="Email"><input name="email" type="email" className="input" /></Field>
          <Field label="Phone"><input name="phone" className="input" /></Field>
        </div>
        <div className="mt-7 flex justify-end gap-3">
          <Link href="/vendors" className="rounded-xl border px-5 py-3 text-sm font-bold text-slate-700">Cancel</Link>
          <button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white">Create Vendor</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>{children}</label>;
}
