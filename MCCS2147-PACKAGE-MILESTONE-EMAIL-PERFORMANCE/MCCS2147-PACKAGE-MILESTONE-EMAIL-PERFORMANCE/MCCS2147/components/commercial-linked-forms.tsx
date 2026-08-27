"use client";

import { useMemo, useState } from "react";
import { createInvoice, createPayment, updatePayment } from "@/app/(dashboard)/_actions/commercial";

type POOption = {
  id: string;
  po_number: string;
  vendor_id: string | null;
  vendor_name: string;
  currency_id: string | null;
  currency_code?: string;
  current_value?: number;
};

type MilestoneOption = {
  id: string;
  purchase_order_id: string;
  milestone_name: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  calculated_amount?: number;
  already_paid?: number;
  remaining_amount?: number;
  planned_due_date?: string | null;
  payment_due_date?: string | null;
  status?: string | null;
};

type VendorOption = { id: string; vendor_name: string };
type CurrencyOption = { id: string; code: string };
type ReviewerOption = { id: string; label: string };
type InvoiceOption = {
  id: string;
  invoice_number: string;
  purchase_order_id: string;
  vendor_id?: string | null;
  vendor_name?: string;
  currency_id?: string | null;
  invoice_amount?: number;
  certified_amount?: number;
};

type PaymentInitial = {
  id: string;
  purchase_order_id?: string | null;
  invoice_id?: string | null;
  payment_milestone_id?: string | null;
  currency_id?: string | null;
  payment_date?: string | null;
  paid_amount?: number | null;
  payment_reference?: string | null;
  bank_reference?: string | null;
  historical_source?: string | null;
  is_historical?: boolean;
  notes?: string | null;
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function InvoiceCreateForm({
  pos,
  vendors,
  currencies,
  milestones,
  reviewers,
}: {
  pos: POOption[];
  vendors: VendorOption[];
  currencies: CurrencyOption[];
  milestones: MilestoneOption[];
  reviewers: ReviewerOption[];
}) {
  const [poId, setPoId] = useState("");
  const selectedPO = useMemo(() => pos.find((p) => p.id === poId) || null, [pos, poId]);
  const poMilestones = useMemo(() => milestones.filter((m) => m.purchase_order_id === poId), [milestones, poId]);
  const [currencyId, setCurrencyId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [amountAutoFilled, setAmountAutoFilled] = useState(false);

  function onPOChange(value: string) {
    setPoId(value);
    const p = pos.find((x) => x.id === value);
    setCurrencyId(p?.currency_id || "");
    setMilestoneId("");
    setInvoiceAmount("");
    setAmountAutoFilled(false);
  }

  function onMilestoneChange(value: string) {
    setMilestoneId(value);
    const m = milestones.find((x) => x.id === value);
    if (!m) {
      setInvoiceAmount("");
      setAmountAutoFilled(false);
      return;
    }
    const amount = Number(m.calculated_amount ?? m.fixed_amount ?? 0);
    setInvoiceAmount(Number.isFinite(amount) ? String(Number(amount.toFixed(2))) : "");
    setAmountAutoFilled(true);
  }

  return (
    <form action={createInvoice} className="mccs-card mt-7 rounded-2xl p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="PO *" hint="PO number and supplier/contractor are shown together.">
          <select name="purchase_order_id" required className="input" value={poId} onChange={(e) => onPOChange(e.target.value)}>
            <option value="">Select PO</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name}</option>
            ))}
          </select>
        </Field>

        <Field label="Vendor / Contractor *">
          <input className="input bg-slate-50 dark:bg-slate-900" value={selectedPO?.vendor_name || "Select a PO first"} readOnly />
          <input type="hidden" name="vendor_id" value={selectedPO?.vendor_id || ""} />
        </Field>

        <Field label="Milestone" hint={poId ? `${poMilestones.length} milestone(s) linked to this PO.` : "Select a PO to load only its milestones."}>
          <select name="milestone_id" className="input" value={milestoneId} onChange={(e) => onMilestoneChange(e.target.value)} disabled={!poId}>
            <option value="">Not linked</option>
            {poMilestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.milestone_name}{m.percentage != null ? ` — ${Number(m.percentage).toLocaleString()}%` : ""}{m.calculated_amount != null ? ` — ${Number(m.calculated_amount).toLocaleString()}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Currency *">
          <select name="currency_id" required className="input" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
            <option value="">Select currency</option>
            {currencies.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </Field>

        <Field label="Invoice Number *"><input name="invoice_number" required className="input" /></Field>
        <Field label="Invoice Date *"><input name="invoice_date" type="date" required className="input" /></Field>
        <Field label="Received Date"><input name="received_date" type="date" className="input" /></Field>
        <Field label="Due Date"><input name="due_date" type="date" className="input" /></Field>
        <Field label="Invoice Amount *" hint={amountAutoFilled ? "Auto-filled from the selected milestone. Super Admin can overwrite this with the actual invoice amount before saving." : "Enter the actual invoice amount, or select a milestone to auto-fill it."}>
          <div className="relative">
            <input name="invoice_amount" type="number" step="0.01" min="0" required className="input pr-28" value={invoiceAmount} onChange={(e) => { setInvoiceAmount(e.target.value); setAmountAutoFilled(false); }} />
            {amountAutoFilled ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">Auto-filled</span> : null}
          </div>
        </Field>
        <Field label="Certified Amount"><input name="certified_amount" type="number" step="0.01" defaultValue="0" className="input" /></Field>
        <Field label="Initial Reviewer">
          <select name="assigned_reviewer_id" className="input"><option value="">Assign later</option>{reviewers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </Field>
        <Field label="Historical Source"><input name="historical_source" className="input" placeholder="Legacy register / email / old system" /></Field>
      </div>

      <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold">Invoice Documents</h2>
        <p className="mt-1 text-sm text-slate-500">Stored automatically under Vendor → Project/Package → Invoice → Invoice Number.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field label="Primary Invoice File"><input name="invoice_file" type="file" accept=".pdf,.xls,.xlsx,.csv,.zip,image/*,.doc,.docx" className="input" /></Field>
          <Field label="Supporting Documents (multiple)"><input name="invoice_supporting_files" type="file" multiple accept=".pdf,.xls,.xlsx,.csv,.zip,image/*,.doc,.docx" className="input" /></Field>
        </div>
      </div>

      <label className="mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"><input type="checkbox" name="is_historical" /> Historical / previously processed invoice</label>
      <Field label="Verification Notes"><textarea name="verification_notes" rows={4} className="input mt-5" /></Field>
      <div className="mt-7 flex justify-end"><button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white dark:bg-blue-600">Create Invoice & Drive Folder</button></div>
    </form>
  );
}

export function PaymentForm({
  pos,
  invoices,
  currencies,
  milestones,
  initial,
}: {
  pos: POOption[];
  invoices: InvoiceOption[];
  currencies: CurrencyOption[];
  milestones: MilestoneOption[];
  initial?: PaymentInitial;
}) {
  const [poId, setPoId] = useState(initial?.purchase_order_id || "");
  const [invoiceId, setInvoiceId] = useState(initial?.invoice_id || "");
  const [milestoneId, setMilestoneId] = useState(initial?.payment_milestone_id || "");
  const initialPO = pos.find((p) => p.id === initial?.purchase_order_id);
  const [currencyId, setCurrencyId] = useState(initial?.currency_id || initialPO?.currency_id || "");
  const [paidAmount, setPaidAmount] = useState(initial?.paid_amount != null ? String(initial.paid_amount) : "");
  const [autoFilled, setAutoFilled] = useState(false);

  const selectedPO = useMemo(() => pos.find((p) => p.id === poId) || null, [pos, poId]);
  const filteredInvoices = useMemo(() => invoices.filter((i) => i.purchase_order_id === poId), [invoices, poId]);
  const filteredMilestones = useMemo(() => milestones.filter((m) => m.purchase_order_id === poId), [milestones, poId]);
  const selectedMilestone = useMemo(() => filteredMilestones.find((m) => m.id === milestoneId) || null, [filteredMilestones, milestoneId]);

  function applyMilestone(mid: string) {
    setMilestoneId(mid);
    const m = milestones.find((x) => x.id === mid);
    if (m) {
      const remaining = Number(m.remaining_amount ?? m.calculated_amount ?? m.fixed_amount ?? 0);
      setPaidAmount(remaining ? String(Number(remaining.toFixed(2))) : "0");
      setAutoFilled(true);
      if (selectedPO?.currency_id) setCurrencyId(selectedPO.currency_id);
    } else {
      setAutoFilled(false);
    }
  }

  function onPOChange(value: string) {
    setPoId(value);
    const p = pos.find((x) => x.id === value);
    setCurrencyId(p?.currency_id || "");
    setInvoiceId("");
    setMilestoneId("");
    if (!initial) setPaidAmount("");
    setAutoFilled(false);
  }

  function onInvoiceChange(value: string) {
    setInvoiceId(value);
    const inv = invoices.find((i) => i.id === value);
    if (inv?.currency_id) setCurrencyId(inv.currency_id);
  }

  const action = initial ? updatePayment : createPayment;

  return (
    <form action={action} className="mccs-card mt-7 rounded-2xl p-6">
      {initial ? <input type="hidden" name="payment_id" value={initial.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="PO *" hint="Supplier/contractor is displayed with the PO number.">
          <select name="purchase_order_id" required className="input" value={poId} onChange={(e) => onPOChange(e.target.value)}>
            <option value="">Select PO</option>
            {pos.map((p) => <option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name}</option>)}
          </select>
        </Field>

        <Field label="Invoice" hint={poId ? "Only invoices belonging to the selected PO are shown." : "Select a PO first."}>
          <select name="invoice_id" className="input" value={invoiceId} onChange={(e) => onInvoiceChange(e.target.value)} disabled={!poId}>
            <option value="">Not linked</option>
            {filteredInvoices.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} — {i.vendor_name || selectedPO?.vendor_name || "Supplier"}</option>)}
          </select>
        </Field>

        <Field label="Payment Milestone" hint={poId ? "Selecting a milestone automatically fills its outstanding amount. Super Admin may override the amount." : "Select a PO first."}>
          <select name="payment_milestone_id" className="input" value={milestoneId} onChange={(e) => applyMilestone(e.target.value)} disabled={!poId}>
            <option value="">Not linked</option>
            {filteredMilestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.milestone_name} — Outstanding {Number(m.remaining_amount ?? m.calculated_amount ?? 0).toLocaleString()}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Currency *">
          <select name="currency_id" required className="input" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
            <option value="">Select currency</option>{currencies.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </Field>

        <Field label="Payment Date *"><input name="payment_date" type="date" required className="input" defaultValue={initial?.payment_date || ""} /></Field>

        <Field label="Paid Amount *" hint={selectedMilestone ? `Milestone amount: ${Number(selectedMilestone.calculated_amount ?? 0).toLocaleString()} • Already paid: ${Number(selectedMilestone.already_paid ?? 0).toLocaleString()} • Outstanding: ${Number(selectedMilestone.remaining_amount ?? 0).toLocaleString()}` : "Enter the actual payment amount."}>
          <div className="relative">
            <input name="paid_amount" type="number" step="0.01" min="0" required className="input pr-28" value={paidAmount} onChange={(e) => { setPaidAmount(e.target.value); setAutoFilled(false); }} />
            {autoFilled ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">Auto-filled</span> : null}
          </div>
        </Field>

        <Field label="Payment Reference"><input name="payment_reference" className="input" defaultValue={initial?.payment_reference || ""} /></Field>
        <Field label="Bank Reference"><input name="bank_reference" className="input" defaultValue={initial?.bank_reference || ""} /></Field>
        <Field label="Historical Source"><input name="historical_source" className="input" placeholder="Old payment tracker / bank statement" defaultValue={initial?.historical_source || ""} /></Field>
        <Field label="Supplier / Contractor"><input className="input bg-slate-50 dark:bg-slate-900" value={selectedPO?.vendor_name || "Select a PO first"} readOnly /></Field>
      </div>

      <label className="mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"><input type="checkbox" name="is_historical" defaultChecked={!!initial?.is_historical} /> Historical / previously paid</label>
      <Field label="Notes"><textarea name="notes" rows={4} className="input mt-5" defaultValue={initial?.notes || ""} /></Field>
      <div className="mt-7 flex justify-end"><button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white dark:bg-blue-600">{initial ? "Save Changes" : "Record Payment"}</button></div>
    </form>
  );
}

export type EditableMilestone = {
  id?: string;
  milestone_name: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  planned_due_date?: string | null;
  payment_due_date?: string | null;
  status?: string | null;
};

export function POMilestoneEditor({ initialRows, currencyCode }: { initialRows: EditableMilestone[]; currencyCode?: string }) {
  const [rows, setRows] = useState<EditableMilestone[]>(initialRows.length ? initialRows : []);
  const totalPct = rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0);

  function patch(index: number, key: keyof EditableMilestone, value: string) {
    setRows((old) => old.map((r, i) => i === index ? { ...r, [key]: key === "percentage" || key === "fixed_amount" ? (value === "" ? null : Number(value)) : value } : r));
  }

  function addRow() {
    setRows((old) => [...old, { milestone_name: "", percentage: null, fixed_amount: null, planned_due_date: "", payment_due_date: "", status: "planned" }]);
  }

  function removeNewRow(index: number) {
    setRows((old) => old.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Payment Milestones</h2>
          <p className="mt-1 text-sm text-slate-500">Edit existing milestones or add new milestones directly while editing this PO.</p>
        </div>
        <button type="button" onClick={addRow} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">+ Add Milestone</button>
      </div>
      <input type="hidden" name="milestone_count" value={rows.length} />
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-3 py-3">Milestone</th><th className="px-3 py-3">%</th><th className="px-3 py-3">Fixed Amount {currencyCode ? `(${currencyCode})` : ""}</th><th className="px-3 py-3">Milestone Due</th><th className="px-3 py-3">Payment Due</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead>
          <tbody className="divide-y dark:divide-slate-800">
            {rows.map((r, i) => (
              <tr key={r.id || `new-${i}`}>
                <td className="px-3 py-3"><input type="hidden" name={`milestone_id_${i}`} value={r.id || ""} /><input name={`milestone_name_${i}`} className="input min-w-[240px]" value={r.milestone_name} onChange={(e) => patch(i, "milestone_name", e.target.value)} placeholder="Milestone name" /></td>
                <td className="px-3 py-3"><input name={`milestone_percentage_${i}`} type="number" step="0.01" min="0" max="100" className="input w-28" value={r.percentage ?? ""} onChange={(e) => patch(i, "percentage", e.target.value)} /></td>
                <td className="px-3 py-3"><input name={`milestone_amount_${i}`} type="number" step="0.01" min="0" className="input w-40" value={r.fixed_amount ?? ""} onChange={(e) => patch(i, "fixed_amount", e.target.value)} /></td>
                <td className="px-3 py-3"><input name={`milestone_due_${i}`} type="date" className="input" value={r.planned_due_date || ""} onChange={(e) => patch(i, "planned_due_date", e.target.value)} /></td>
                <td className="px-3 py-3"><input name={`milestone_payment_due_${i}`} type="date" className="input" value={r.payment_due_date || ""} onChange={(e) => patch(i, "payment_due_date", e.target.value)} /></td>
                <td className="px-3 py-3"><select name={`milestone_status_${i}`} className="input" value={r.status || "planned"} onChange={(e) => patch(i, "status", e.target.value)}><option value="planned">Planned</option><option value="due">Due</option><option value="submitted">Submitted</option><option value="certified">Certified</option><option value="paid">Paid</option><option value="on_hold">On Hold</option></select></td>
                <td className="px-3 py-3">{r.id ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Editable existing</span> : <button type="button" className="text-sm font-bold text-red-600" onClick={() => removeNewRow(i)}>Remove new</button>}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No milestones yet. Click “Add Milestone”.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${totalPct > 100.0001 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
        Total milestone allocation: {totalPct.toFixed(2)}% {totalPct > 100.0001 ? "— must not exceed 100%." : ""}
      </div>
    </div>
  );
}
