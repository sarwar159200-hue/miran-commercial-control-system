"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

type Consequence = { label: string; value: string | number; tone?: "danger" | "warn" | "info" };

type Props = {
  entity: "vendor" | "project" | "purchase_order" | "milestone" | "invoice" | "payment" | "document";
  entityId: string;
  entityLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  idField: string;
  className?: string;
  mode?: "soft" | "purge";
};

export default function SuperAdminDelete({ entity, entityId, entityLabel, action, idField, className, mode = "soft" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consequences, setConsequences] = useState<Consequence[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const canDelete = useMemo(() => confirmText.trim() === entityLabel.trim() && reason.trim().length >= 3, [confirmText, entityLabel, reason]);
  const purge = mode === "purge";

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/admin/delete-consequences?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(entityId)}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Unable to calculate deletion consequences.");
        if (active) setConsequences(body.consequences || []);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Unable to calculate deletion consequences."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [open, entity, entityId]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className={className || "inline-flex items-center gap-1 font-bold text-red-700 hover:text-red-800"}>
      <Trash2 className="h-4 w-4" /> {purge ? "Purge Test PO" : "Delete"}
    </button>
    {open ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between border-b p-5 dark:border-slate-800">
          <div className="flex gap-3"><div className="rounded-xl bg-red-50 p-2 text-red-700"><AlertTriangle className="h-5 w-5" /></div><div><h2 className="text-xl font-bold">{purge ? `Permanently purge ${entityLabel}?` : `Delete ${entityLabel}?`}</h2><p className="mt-1 text-sm text-slate-500">{purge ? "Permanent Super Admin test-data cleanup. This cannot be undone." : "Super Admin controlled deletion. Review the consequences before confirming."}</p></div></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
            {purge ? <>This is a <b>permanent purge</b>. MCCS will only allow it when the deleted PO has no linked milestones, invoices, payments, documents or PO items. A minimal purge audit event is retained.</> : <>This is an <b>audit-safe soft delete</b>. The record will disappear from normal MCCS registers and reports, but the database audit trail will be retained. Google Drive files are not physically deleted by this action.</>}
          </div>
          <div><div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Deletion consequences</div>
            {loading ? <div className="rounded-xl border p-4 text-sm text-slate-500">Calculating linked records…</div> : error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <div className="grid gap-2 sm:grid-cols-2">{consequences.map((c, i) => <div key={i} className={`rounded-xl border p-3 ${c.tone === "danger" ? "border-red-200 bg-red-50" : c.tone === "warn" ? "border-amber-200 bg-amber-50" : "bg-slate-50 dark:bg-slate-900"}`}><div className="text-xs font-bold uppercase text-slate-500">{c.label}</div><div className="mt-1 text-lg font-bold">{c.value}</div></div>)}</div>}
          </div>
          <div><label className="text-sm font-bold">Reason for deletion *</label><textarea value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2 dark:bg-slate-900" placeholder="e.g. Test data cleanup / duplicate entry" /></div>
          <div><label className="text-sm font-bold">Type <span className="text-red-700">{entityLabel}</span> to confirm *</label><input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 dark:bg-slate-900" /></div>
        </div>
        <div className="flex justify-end gap-2 border-t p-5 dark:border-slate-800"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Cancel</button><form action={action}><input type="hidden" name={idField} value={entityId}/><input type="hidden" name="delete_reason" value={reason}/><button disabled={!canDelete || loading || !!error} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{purge ? "Permanently Purge" : "Confirm Delete"}</button></form></div>
      </div>
    </div> : null}
  </>;
}
