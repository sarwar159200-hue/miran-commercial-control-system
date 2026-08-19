"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/mccs/auth";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function nullable(formData: FormData, key: string) {
  return text(formData, key) || null;
}

function num(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/,/g, "");
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${key} must be a valid number.`);
  return parsed;
}

export async function createMainVendor(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const vendorName = text(formData, "vendor_name");
  if (!vendorName) redirect("/vendors/main/new?error=Vendor%20name%20is%20required");

  const { error } = await supabase.from("vendors").insert({
    vendor_code: nullable(formData, "vendor_code"),
    vendor_name: vendorName,
    legal_name: nullable(formData, "legal_name"),
    relationship_type: text(formData, "relationship_type") || "direct_contractor",
    parent_vendor_id: null,
    country: nullable(formData, "country"),
    address: nullable(formData, "address"),
    contact_person: nullable(formData, "contact_person"),
    email: nullable(formData, "email"),
    phone: nullable(formData, "phone"),
    tax_number: nullable(formData, "tax_number"),
    default_currency_id: nullable(formData, "default_currency_id"),
    is_active: true,
    notes: nullable(formData, "notes"),
    created_by: user.id,
  });

  if (error) redirect(`/vendors/main/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/vendors");
  redirect("/vendors?created=main");
}

export async function createSubVendor(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const vendorName = text(formData, "vendor_name");
  const parentVendorId = text(formData, "parent_vendor_id");

  if (!vendorName) redirect("/vendors/subvendors/new?error=Vendor%20name%20is%20required");
  if (!parentVendorId) redirect("/vendors/subvendors/new?error=Parent%20vendor%20is%20required");

  const { error } = await supabase.from("vendors").insert({
    vendor_code: nullable(formData, "vendor_code"),
    vendor_name: vendorName,
    legal_name: nullable(formData, "legal_name"),
    relationship_type: text(formData, "relationship_type") || "subcontractor",
    parent_vendor_id: parentVendorId,
    country: nullable(formData, "country"),
    address: nullable(formData, "address"),
    contact_person: nullable(formData, "contact_person"),
    email: nullable(formData, "email"),
    phone: nullable(formData, "phone"),
    tax_number: nullable(formData, "tax_number"),
    default_currency_id: nullable(formData, "default_currency_id"),
    is_active: true,
    notes: nullable(formData, "notes"),
    created_by: user.id,
  });

  if (error) redirect(`/vendors/subvendors/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/vendors");
  redirect("/vendors?created=sub");
}

export async function createCurrency(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const code = text(formData, "code").toUpperCase();
  const name = text(formData, "name");

  if (!code || !name) redirect("/admin/currencies/new?error=Code%20and%20name%20are%20required");

  const decimalPlaces = Number(text(formData, "decimal_places") || "2");
  const { error } = await supabase.from("currencies").insert({
    code,
    name,
    symbol: nullable(formData, "symbol"),
    decimal_places: decimalPlaces,
    is_active: true,
    created_by: user.id,
  });

  if (error) redirect(`/admin/currencies/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/currencies");
  redirect("/admin/currencies?created=1");
}

export async function createPurchaseOrder(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();

  const poNumber = text(formData, "po_number");
  const vendorId = text(formData, "vendor_id");
  const currencyId = text(formData, "currency_id");
  const poDate = text(formData, "po_date");

  if (!poNumber || !vendorId || !currencyId || !poDate) {
    redirect("/purchase-orders/new?error=PO%20number%2C%20vendor%2C%20currency%20and%20PO%20date%20are%20required");
  }

  const historical = formData.get("is_historical") === "on";

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({
      project_id: nullable(formData, "project_id"),
      vendor_id: vendorId,
      parent_contractor_id: nullable(formData, "parent_contractor_id"),
      po_number: poNumber,
      pr_number: nullable(formData, "pr_number"),
      rfq_number: nullable(formData, "rfq_number"),
      po_date: poDate,
      approval_date: nullable(formData, "approval_date"),
      approved_by_text: nullable(formData, "approved_by_text"),
      currency_id: currencyId,
      original_value: num(formData, "original_value"),
      approved_variations: 0,
      payment_terms: nullable(formData, "payment_terms"),
      delivery_terms: nullable(formData, "delivery_terms"),
      delivery_due_date: nullable(formData, "delivery_due_date"),
      status: text(formData, "status") || "active",
      is_historical: historical,
      historical_source: nullable(formData, "historical_source"),
      historical_imported_at: historical ? new Date().toISOString() : null,
      historical_imported_by: historical ? user.id : null,
      notes: nullable(formData, "notes"),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !po) redirect(`/purchase-orders/new?error=${encodeURIComponent(error?.message || "Unable to create PO")}`);

  const milestoneCount = Number(text(formData, "milestone_count") || "0");
  const rows = [];
  for (let i = 0; i < milestoneCount; i++) {
    const name = text(formData, `milestone_name_${i}`);
    if (!name) continue;
    const percentageRaw = text(formData, `milestone_percentage_${i}`);
    const amountRaw = text(formData, `milestone_amount_${i}`);
    rows.push({
      purchase_order_id: po.id,
      sequence_no: i + 1,
      milestone_name: name,
      percentage: percentageRaw ? Number(percentageRaw) : null,
      fixed_amount: amountRaw ? Number(amountRaw.replace(/,/g, "")) : null,
      planned_due_date: nullable(formData, `milestone_due_${i}`),
      payment_due_date: nullable(formData, `milestone_payment_due_${i}`),
      discipline: nullable(formData, `milestone_discipline_${i}`),
      verification_required: true,
      status: "planned",
      is_historical: historical,
      created_by: user.id,
    });
  }

  if (rows.length) {
    const { error: milestoneError } = await supabase.from("payment_milestones").insert(rows);
    if (milestoneError) {
      redirect(`/purchase-orders/${po.id}?warning=${encodeURIComponent("PO created, but milestone save failed: " + milestoneError.message)}`);
    }
  }

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${po.id}`);

  const { data: savedPo, error: verifyError } = await supabase
    .from("purchase_orders")
    .select("id,po_number")
    .eq("id", po.id)
    .maybeSingle();

  if (verifyError || !savedPo) {
    redirect(`/purchase-orders?warning=${encodeURIComponent(
      "PO was created, but the detail page could not read it immediately. " +
      (verifyError?.message || "Please refresh the PO register.")
    )}`);
  }

  redirect(`/purchase-orders/${po.id}?created=1`);
}

export async function amendPurchaseOrder(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const poId = text(formData, "po_id");
  const revisionNo = text(formData, "revision_no");
  const valueChange = num(formData, "value_change");
  const reason = text(formData, "reason");

  if (!poId || !revisionNo || !reason) redirect(`/purchase-orders/${poId}?error=Revision%20number%20and%20reason%20are%20required`);

  const { error: revError } = await supabase.from("po_revisions").insert({
    purchase_order_id: poId,
    revision_no: revisionNo,
    revision_date: text(formData, "revision_date") || new Date().toISOString().slice(0, 10),
    value_change: valueChange,
    reason,
    created_by: user.id,
  });

  if (revError) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(revError.message)}`);

  const { data: current } = await supabase.from("purchase_orders").select("approved_variations").eq("id", poId).single();
  const newVariations = Number(current?.approved_variations || 0) + valueChange;

  const { error } = await supabase
    .from("purchase_orders")
    .update({ approved_variations: newVariations })
    .eq("id", poId);

  if (error) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${poId}?amended=1`);
}

export async function holdPurchaseOrder(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const poId = text(formData, "po_id");
  const reason = text(formData, "hold_reason");

  const { error } = await supabase.from("purchase_orders").update({
    status: "on_hold",
    hold_reason: reason || "Placed on hold by Super Admin",
    held_at: new Date().toISOString(),
    held_by: user.id,
  }).eq("id", poId);

  if (error) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${poId}?held=1`);
}

export async function releasePurchaseOrder(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const poId = text(formData, "po_id");

  const { error } = await supabase.from("purchase_orders").update({
    status: "active",
    hold_reason: null,
    held_at: null,
    held_by: null,
  }).eq("id", poId);

  if (error) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${poId}?released=1`);
}

export async function softDeletePurchaseOrder(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const poId = text(formData, "po_id");

  const { error } = await supabase.from("purchase_orders").update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
    status: "cancelled",
  }).eq("id", poId);

  if (error) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/purchase-orders");
  redirect("/purchase-orders?deleted=1");
}


export async function createProject(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();

  const projectCode = text(formData, "project_code");
  const projectName = text(formData, "project_name");

  if (!projectCode || !projectName) {
    redirect("/admin/projects/new?error=Project%20code%20and%20project%20name%20are%20required");
  }

  const { error } = await supabase.from("projects").insert({
    project_code: projectCode,
    project_name: projectName,
    description: nullable(formData, "description"),
    start_date: nullable(formData, "start_date"),
    planned_finish_date: nullable(formData, "planned_finish_date"),
    is_active: true,
    created_by: user.id,
  });

  if (error) {
    redirect(`/admin/projects/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/projects");
  revalidatePath("/purchase-orders/new");
  redirect("/admin/projects?created=1");
}

export async function deactivateProject(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const projectId = text(formData, "project_id");

  const { error } = await supabase
    .from("projects")
    .update({ is_active: false })
    .eq("id", projectId);

  if (error) {
    redirect(`/admin/projects?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/projects");
  revalidatePath("/purchase-orders/new");
  redirect("/admin/projects?deactivated=1");
}

export async function createInvoice(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const poId=text(formData,"purchase_order_id"), vendorId=text(formData,"vendor_id"), currencyId=text(formData,"currency_id");
  const { error }=await supabase.from("invoices").insert({purchase_order_id:poId,vendor_id:vendorId,milestone_id:nullable(formData,"milestone_id"),invoice_number:text(formData,"invoice_number"),invoice_date:text(formData,"invoice_date"),received_date:nullable(formData,"received_date"),currency_id:currencyId,invoice_amount:num(formData,"invoice_amount"),certified_amount:num(formData,"certified_amount"),status:text(formData,"status")||"received",due_date:nullable(formData,"due_date"),verification_notes:nullable(formData,"verification_notes"),created_by:user.id});
  if(error) redirect(`/invoices/new?error=${encodeURIComponent(error.message)}`); revalidatePath("/invoices"); revalidatePath("/dashboard"); redirect("/invoices?created=1");
}
export async function createPayment(formData: FormData) {
  const { supabase, user }=await requireSuperAdmin();
  const { error }=await supabase.from("payments").insert({invoice_id:nullable(formData,"invoice_id"),purchase_order_id:text(formData,"purchase_order_id"),currency_id:text(formData,"currency_id"),payment_date:text(formData,"payment_date"),paid_amount:num(formData,"paid_amount"),payment_reference:nullable(formData,"payment_reference"),bank_reference:nullable(formData,"bank_reference"),notes:nullable(formData,"notes"),created_by:user.id});
  if(error) redirect(`/payments/new?error=${encodeURIComponent(error.message)}`); revalidatePath("/payments"); revalidatePath("/dashboard"); redirect("/payments?created=1");
}
