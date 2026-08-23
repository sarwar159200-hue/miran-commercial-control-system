"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function GoogleDriveUploadForm({
  projects,
  purchaseOrders,
  invoices,
  vendors,
  milestones,
  initialPoId = "",
  initialInvoiceId = "",
}: {
  projects: any[];
  purchaseOrders: any[];
  invoices: any[];
  vendors: any[];
  milestones: any[];
  initialPoId?: string;
  initialInvoiceId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [loading, setLoading] = useState(false);
  const [poId, setPoId] = useState(initialPoId);
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);

  const selectedInvoice = useMemo(() => invoices.find((x) => String(x.id) === invoiceId), [invoiceId, invoices]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setProgress("Uploading to Google Drive...");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    form.set("is_historical", (event.currentTarget.elements.namedItem("is_historical") as HTMLInputElement)?.checked ? "true" : "false");

    try {
      const response = await fetch("/api/google-drive/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setProgress("Upload completed and registered in MCCS.");
      router.push("/documents?uploaded=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mccs-card mt-7 rounded-2xl p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="File *"><input name="file" type="file" required className="input" /></Field>
        <Field label="Document Title *"><input name="document_title" required className="input" placeholder="e.g. Purchase Order, Vendor Invoice, Delivery Note" /></Field>
        <Field label="Document Type *"><input name="document_type" required className="input" placeholder="PO / Invoice / Contract / Supporting Document" /></Field>
        <Field label="Revision"><input name="revision" className="input" placeholder="Rev 0 / Rev A / Rev 1" /></Field>

        <Field label="Project">
          <select name="project_id" className="input"><option value="">Derive from PO / Unassigned</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.project_code} — {x.project_name}</option>)}</select>
        </Field>
        <Field label="Contractor / Vendor">
          <select name="vendor_id" className="input"><option value="">Derive from PO / Invoice</option>{vendors.map((x) => <option key={x.id} value={x.id}>{x.vendor_name}</option>)}</select>
        </Field>

        <Field label="Assign to Purchase Order">
          <select name="purchase_order_id" className="input" value={poId} onChange={(e) => setPoId(e.target.value)}>
            <option value="">Not linked</option>{purchaseOrders.map((x) => <option key={x.id} value={x.id}>{x.po_number}</option>)}
          </select>
        </Field>
        <Field label="Assign to Invoice">
          <select name="invoice_id" className="input" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">Not linked</option>{invoices.map((x) => <option key={x.id} value={x.id}>{x.invoice_number}{x.po_number ? ` — ${x.po_number}` : ""}</option>)}
          </select>
          {selectedInvoice?.invoice_number ? <span className="mt-1 block text-xs text-slate-500">Selected invoice: {selectedInvoice.invoice_number}</span> : null}
        </Field>

        <Field label="Payment Milestone">
          <select name="milestone_id" className="input"><option value="">Not linked</option>{milestones.map((x) => <option key={x.id} value={x.id}>{x.milestone_name}</option>)}</select>
        </Field>
      </div>

      {!poId && !invoiceId ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Select at least one Purchase Order or Invoice before upload.</div> : null}

      <label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" name="is_historical" /> Historical document</label>
      {progress ? <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">{progress}</div> : null}
      {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}

      <div className="mt-7 flex justify-end"><button disabled={loading || (!poId && !invoiceId)} className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-blue-600">{loading ? "Uploading..." : "Upload to Google Drive"}</button></div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>{children}</label>;
}
