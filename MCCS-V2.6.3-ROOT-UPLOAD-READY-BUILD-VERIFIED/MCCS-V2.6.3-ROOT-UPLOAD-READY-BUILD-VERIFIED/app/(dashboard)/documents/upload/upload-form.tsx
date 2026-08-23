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
  const [vendorId, setVendorId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState(initialInvoiceId ? "invoice" : initialPoId ? "po" : "other_document");
  const [poId, setPoId] = useState(initialPoId);
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);

  const filteredProjects = useMemo(() => projects.filter((p) => !vendorId || !p.vendor_id || String(p.vendor_id) === vendorId), [projects, vendorId]);
  const filteredPOs = useMemo(() => purchaseOrders.filter((p) => (!vendorId || String(p.vendor_id) === vendorId) && (!projectId || String(p.project_id) === projectId)), [purchaseOrders, vendorId, projectId]);
  const filteredInvoices = useMemo(() => invoices.filter((i) => (!vendorId || String(i.vendor_id) === vendorId) && (!projectId || String(i.project_id) === projectId)), [invoices, vendorId, projectId]);

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
      setProgress(`${data.count || 1} file(s) uploaded and registered in MCCS.`);
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
      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
        Google Drive sequence: <strong>Vendor / Contractor → Project / Package → PO / Invoice / SRF / Other Documents</strong>.
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Vendor / Contractor *"><select name="vendor_id" required className="input" value={vendorId} onChange={(e)=>{setVendorId(e.target.value);setProjectId("");setPoId("");setInvoiceId("");}}><option value="">Select vendor</option>{vendors.map((x)=><option key={x.id} value={x.id}>{x.vendor_name}</option>)}</select></Field>
        <Field label="Project / Supply Package *"><select name="project_id" required className="input" value={projectId} onChange={(e)=>{setProjectId(e.target.value);setPoId("");setInvoiceId("");}}><option value="">Select project / package</option>{filteredProjects.map((x)=><option key={x.id} value={x.id}>{x.project_name}{x.project_code ? ` (${x.project_code})` : ""}</option>)}</select></Field>
        <Field label="Document Section *"><select name="document_category" required className="input" value={category} onChange={(e)=>setCategory(e.target.value)}><option value="po">PO</option><option value="invoice">Invoice</option><option value="srf">SRF</option><option value="other_document">Other Document</option></select></Field>
        <Field label="Document Title"><input name="document_title" className="input" placeholder="e.g. Technical Offer / Delivery Note / SRF" /></Field>
        <Field label="Document Type *"><input name="document_type" required className="input" placeholder="PO PDF / Invoice / Technical Offer / Supporting Document" /></Field>
        <Field label="Revision"><input name="revision" className="input" placeholder="Rev 0 / Rev A / Rev 1" /></Field>

        {category === "po" ? <Field label="Purchase Order *"><select name="purchase_order_id" required className="input" value={poId} onChange={(e)=>setPoId(e.target.value)}><option value="">Select PO</option>{filteredPOs.map((x)=><option key={x.id} value={x.id}>{x.po_number}</option>)}</select></Field> : <input type="hidden" name="purchase_order_id" value={poId} />}
        {category === "invoice" ? <Field label="Invoice *"><select name="invoice_id" required className="input" value={invoiceId} onChange={(e)=>setInvoiceId(e.target.value)}><option value="">Select invoice</option>{filteredInvoices.map((x)=><option key={x.id} value={x.id}>{x.invoice_number}{x.po_number ? ` — ${x.po_number}` : ""}</option>)}</select></Field> : <input type="hidden" name="invoice_id" value={invoiceId} />}

        <Field label="Payment Milestone"><select name="milestone_id" className="input"><option value="">Not linked</option>{milestones.map((x)=><option key={x.id} value={x.id}>{x.milestone_name}</option>)}</select></Field>
        <Field label="Files * (multiple allowed)"><input name="files" type="file" multiple required accept=".pdf,.xls,.xlsx,.csv,.zip,image/*,.doc,.docx" className="input" /></Field>
      </div>

      <label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" name="is_historical" /> Historical document</label>
      {progress ? <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">{progress}</div> : null}
      {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
      <div className="mt-7 flex justify-end"><button disabled={loading || !vendorId || !projectId} className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-blue-600">{loading ? "Uploading..." : "Upload to Google Drive"}</button></div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>{children}</label>;
}
