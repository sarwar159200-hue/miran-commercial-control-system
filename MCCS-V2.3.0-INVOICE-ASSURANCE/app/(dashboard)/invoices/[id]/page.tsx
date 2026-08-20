import Link from "next/link";
import { assignInvoiceReviewer, reviewInvoice, finalApproveInvoice, returnInvoiceCommercial, markInvoiceSubmittedToAP } from "../../_actions/commercial";
import { currentAccess } from "@/lib/mccs/invoice-auth";
export const dynamic = "force-dynamic";

function Badge({ status }: { status: string }) {
  const cls = status === "approved_for_payment" ? "bg-emerald-50 text-emerald-700" : status === "technical_approved" ? "bg-blue-50 text-blue-700" : status === "returned" ? "bg-red-50 text-red-700" : status === "submitted_to_ap" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${cls}`}>{status.replaceAll("_", " ")}</span>;
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const a = await currentAccess();
  const s = a.supabase;

  const { data: invoice, error: invoiceError } = await s.from("invoices").select("*").eq("id", id).maybeSingle();
  if (invoiceError) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{invoiceError.message}</div>;
  if (!invoice) return <div>Invoice not found.</div>;

  const [approvalResult, poResult, vendorResult, currencyResult, milestoneResult, profileResult, userRoleResult, roleResult] = await Promise.all([
    s.from("invoice_approvals").select("*").eq("invoice_id", id).order("action_at"),
    invoice.purchase_order_id ? s.from("purchase_orders").select("id,po_number,current_value,currency_id").eq("id", invoice.purchase_order_id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    s.from("vendors").select("id,vendor_name"),
    s.from("currencies").select("id,code"),
    s.from("payment_milestones").select("id,milestone_name"),
    s.from("profiles").select("id,full_name,preferred_name,is_active").eq("is_active", true),
    s.from("user_roles").select("user_id,role_id"),
    s.from("roles").select("id,role_code"),
  ]);

  const vendors = new Map<string, string>((vendorResult.data ?? []).map((v: any) => [String(v.id), String(v.vendor_name)]));
  const curr = new Map<string, string>((currencyResult.data ?? []).map((v: any) => [String(v.id), String(v.code)]));
  const miles = new Map<string, string>((milestoneResult.data ?? []).map((v: any) => [String(v.id), String(v.milestone_name)]));
  const profiles = new Map<string, string>((profileResult.data ?? []).map((p: any) => [String(p.id), String(p.preferred_name || p.full_name)]));
  const allowed = new Set((roleResult.data ?? []).filter((r: any) => ["discipline_engineer", "project_manager", "commercial", "admin", "super_admin"].includes(String(r.role_code))).map((r: any) => String(r.id)));
  const reviewerIds = new Set((userRoleResult.data ?? []).filter((z: any) => allowed.has(String(z.role_id))).map((z: any) => String(z.user_id)));
  const reviewers = (profileResult.data ?? []).filter((p: any) => reviewerIds.has(String(p.id)));
  const isAssigned = invoice.assigned_reviewer_id === a.user.id;
  const canReview = a.isSuperAdmin || isAssigned;

  return <div className="mx-auto max-w-[1450px]">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Invoice Assurance</div>
        <h1 className="mt-2 text-3xl font-bold">{invoice.invoice_number}</h1>
        <div className="mt-3 flex items-center gap-3"><Badge status={String(invoice.workflow_status || "received")} /><span className="text-sm text-slate-500">{invoice.verification_ref || "Verification reference pending"}</span></div>
      </div>
      <div className="flex flex-wrap gap-2"><Link href={`/invoices/${id}/verification`} className="rounded-xl border bg-white px-4 py-3 text-sm font-bold dark:bg-slate-900">Verification Sheet</Link><Link href={`/invoices/${id}/edit`} className="rounded-xl border bg-white px-4 py-3 text-sm font-bold dark:bg-slate-900">Edit Invoice</Link><Link href="/invoices" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold dark:bg-slate-900">Back</Link></div>
    </div>
    {q.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{q.error}</div> : null}
    <div className="mt-6 grid gap-4 md:grid-cols-4"><K l="PO" v={poResult.data?.po_number || "—"} /><K l="Vendor" v={vendors.get(String(invoice.vendor_id)) || "—"} /><K l="Invoice Value" v={`${curr.get(String(invoice.currency_id)) || ""} ${Number(invoice.invoice_amount || 0).toLocaleString()}`} /><K l="Certified" v={`${curr.get(String(invoice.currency_id)) || ""} ${Number(invoice.certified_amount || 0).toLocaleString()}`} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <section className="mccs-card rounded-2xl p-6">
        <h2 className="text-lg font-bold">Verification Control</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2"><D l="Milestone" v={miles.get(String(invoice.payment_milestone_id)) || "Not linked"} /><D l="Assigned Reviewer" v={profiles.get(String(invoice.assigned_reviewer_id)) || "Not assigned"} /><D l="Invoice Date" v={invoice.invoice_date || "—"} /><D l="Due Date" v={invoice.due_date || "—"} /><D l="Historical" v={invoice.is_historical ? `Yes${invoice.historical_source ? ` — ${invoice.historical_source}` : ""}` : "No"} /><D l="Notes" v={invoice.verification_notes || "—"} /></div>
        {a.isSuperAdmin ? <form action={assignInvoiceReviewer} className="mt-6 rounded-xl border p-4"><input type="hidden" name="invoice_id" value={id} /><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><select name="reviewer_id" defaultValue={invoice.assigned_reviewer_id || ""} required className="input"><option value="">Select reviewer</option>{reviewers.map((p: any) => <option key={p.id} value={p.id}>{p.preferred_name || p.full_name}</option>)}</select><input name="comments" className="input" placeholder="Assignment note (optional)" /><button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Assign & Send</button></div></form> : null}
        {canReview && invoice.workflow_status === "under_verification" ? <form action={reviewInvoice} className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:bg-blue-950/20"><input type="hidden" name="invoice_id" value={id} /><textarea name="comments" rows={3} className="input" placeholder="Reviewer comments / technical verification notes" /><div className="mt-3 flex gap-2"><button name="review_action" value="approve" className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">Approve Technical Verification</button><button name="review_action" value="return" className="rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white">Return with Comment</button></div></form> : null}
        {a.isSuperAdmin && invoice.workflow_status === "technical_approved" ? <div className="mt-5 grid gap-3 md:grid-cols-2"><form action={finalApproveInvoice} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:bg-emerald-950/20"><input type="hidden" name="invoice_id" value={id} /><textarea name="comments" rows={2} className="input" placeholder="Commercial verification comment" /><button className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">Accept for Payment</button></form><form action={returnInvoiceCommercial} className="rounded-xl border border-red-200 bg-red-50 p-4 dark:bg-red-950/20"><input type="hidden" name="invoice_id" value={id} /><textarea name="comments" required rows={2} className="input" placeholder="Reason for return" /><button className="mt-3 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white">Return Invoice</button></form></div> : null}
        {a.isSuperAdmin && invoice.workflow_status === "approved_for_payment" ? <form action={markInvoiceSubmittedToAP} className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:bg-violet-950/20"><input type="hidden" name="invoice_id" value={id} /><input name="comments" className="input" placeholder="AP release note / reference (optional)" /><button className="mt-3 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white">Release to Accounts Payable Queue</button><p className="mt-2 text-xs text-slate-500">V2.3 records AP release. Automatic email sending is planned for the next integration revision.</p></form> : null}
      </section>
      <section className="mccs-card rounded-2xl p-6"><h2 className="text-lg font-bold">Approval History</h2><div className="mt-4 space-y-3">{(approvalResult.data ?? []).map((r: any) => <div key={r.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div className="font-bold capitalize">{String(r.stage).replaceAll("_", " ")} — {String(r.action).replaceAll("_", " ")}</div><div className="text-xs text-slate-500">{new Date(r.action_at).toLocaleString()}</div></div><div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.comments || "No comment"}</div></div>)}{!(approvalResult.data ?? []).length ? <div className="text-sm text-slate-500">No approval actions yet.</div> : null}</div></section>
    </div>
  </div>;
}
function K({ l, v }: { l: string; v: string }) { return <div className="mccs-card rounded-2xl p-5"><div className="text-xs font-bold uppercase text-slate-500">{l}</div><div className="mt-2 text-xl font-bold">{v}</div></div>; }
function D({ l, v }: { l: string; v: string }) { return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><div className="text-xs font-bold uppercase text-slate-500">{l}</div><div className="mt-1 font-semibold">{v}</div></div>; }
