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
