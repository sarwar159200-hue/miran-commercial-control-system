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

  const filteredProjects = useMemo(() => projects.filter((p) => !vendorId || String(p.vendor_id) === vendorId), [projects, vendorId]);
  const filteredPOs = useMemo(() => purchaseOrders.filter((p) => (!vendorId || String(p.vendor_id) === vendorId) && (!projectId || String(p.project_id) === projectId)), [purchaseOrders, vendorId, projectId]);
  const filteredInvoices = useMemo(() => invoices.filter((i) => (!vendorId || String(i.vendor_id) === vendorId) && (!projectId || String(i.project_id) === projectId)), [invoices, vendorId, projectId]);

  async function readJson(response: Response) {
    const text = await response.text();
    if (!text) return {} as any;
    try { return JSON.parse(text); }
    catch {
      throw new Error(response.ok ? "The server returned an unexpected response." : `Upload failed (${response.status}). ${text.slice(0, 220)}`);
    }
  }

  async function uploadOneFile(file: File, values: Record<string, string | boolean>, fileIndex: number, fileCount: number) {
    const initResponse = await fetch("/api/google-drive/resumable/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
      }),
    });
    const init = await readJson(initResponse);
    if (!initResponse.ok) throw new Error(init.error || "Could not start Google Drive upload.");

    // Keep each request safely below common serverless request-body limits.
    // This removes the former whole-file API body limit and supports very large files
    // by transferring them as a sequence of resumable chunks.
    const CHUNK_SIZE = 4 * 1024 * 1024;
    let offset = 0;
    let finalItem: any = null;

    while (offset < file.size) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const chunk = file.slice(offset, end);
      const percent = Math.max(1, Math.round((end / file.size) * 100));
      setProgress(`Uploading ${fileIndex + 1}/${fileCount}: ${file.name} — ${percent}%`);
      const chunkResponse = await fetch("/api/google-drive/resumable/chunk", {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
          "X-MCCS-Upload-Session": init.sessionUrl,
          "X-MCCS-Upload-Token": init.uploadToken || "",
        },
        body: chunk,
      });
      const result = await readJson(chunkResponse);
      if (!chunkResponse.ok) throw new Error(result.error || `Upload failed while sending ${file.name}.`);
      if (result.complete) finalItem = result.item;
      offset = end;
    }

    if (!finalItem?.id) throw new Error(`Google Drive did not confirm completion for ${file.name}.`);
    const completeResponse = await fetch("/api/google-drive/resumable/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        document_title: init.title,
        invoice_purchase_order_id: init.invoicePurchaseOrderId,
        parent_id: init.parentId,
        drive_path: init.path,
        item: finalItem,
      }),
    });
    const completed = await readJson(completeResponse);
    if (!completeResponse.ok) throw new Error(completed.error || `Could not register ${file.name} in MCCS.`);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const files = form.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
    if (!files.length) { setError("Please select at least one file."); setLoading(false); return; }

    const values: Record<string, string | boolean> = {
      vendor_id: String(form.get("vendor_id") || ""),
      project_id: String(form.get("project_id") || ""),
      purchase_order_id: String(form.get("purchase_order_id") || ""),
      invoice_id: String(form.get("invoice_id") || ""),
      milestone_id: String(form.get("milestone_id") || ""),
      document_category: String(form.get("document_category") || "other_document"),
      document_title: String(form.get("document_title") || ""),
      document_type: String(form.get("document_type") || "Supporting Document"),
      revision: String(form.get("revision") || ""),
      is_historical: Boolean((formElement.elements.namedItem("is_historical") as HTMLInputElement)?.checked),
    };

    try {
      // Upload up to three independent files concurrently. Each individual file still
      // uses ordered resumable chunks, preserving Google Drive integrity while greatly
      // reducing total wait time for multi-file uploads.
      const concurrency = Math.min(3, files.length);
      let next = 0;
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (true) {
          const i = next++;
          if (i >= files.length) return;
          await uploadOneFile(files[i], values, i, files.length);
        }
      }));
      setProgress(`${files.length} file(s) uploaded to Google Drive and registered in MCCS.`);
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
        <Field label="Files * (multiple allowed)"><input name="files" type="file" multiple required accept=".pdf,.xls,.xlsx,.csv,.zip,image/*,.doc,.docx" className="input" /><span className="mt-2 block text-xs text-slate-500">Large files are uploaded in resumable chunks. MCCS does not impose the previous single-request file-size limit; Google Drive account/storage and network limits still apply.</span></Field>
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
