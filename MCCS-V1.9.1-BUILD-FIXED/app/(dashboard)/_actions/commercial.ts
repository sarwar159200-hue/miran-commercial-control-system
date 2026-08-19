"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireSuperAdmin() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin,is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin || !profile?.is_active) {
    throw new Error("Super Admin permission is required.");
  }

  return { supabase, user };
}

export async function createVendor(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();

  const vendorName = String(formData.get("vendor_name") || "").trim();
  if (!vendorName) throw new Error("Vendor name is required.");

  const parentVendorId = String(formData.get("parent_vendor_id") || "").trim() || null;
  const defaultCurrencyId = String(formData.get("default_currency_id") || "").trim() || null;

  const { error } = await supabase.from("vendors").insert({
    vendor_code: String(formData.get("vendor_code") || "").trim() || null,
    vendor_name: vendorName,
    legal_name: String(formData.get("legal_name") || "").trim() || null,
    relationship_type: String(formData.get("relationship_type") || "supplier"),
    parent_vendor_id: parentVendorId,
    country: String(formData.get("country") || "").trim() || null,
    contact_person: String(formData.get("contact_person") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    default_currency_id: defaultCurrencyId,
    is_active: true,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/vendors");
  redirect("/vendors?created=1");
}

export async function createPurchaseOrder(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();

  const poNumber = String(formData.get("po_number") || "").trim();
  if (!poNumber) throw new Error("PO number is required.");

  const parseNum = (name: string) => {
    const raw = String(formData.get(name) || "").replace(/,/g, "").trim();
    return raw ? Number(raw) : 0;
  };

  const { error } = await supabase.from("purchase_orders").insert({
    project_id: String(formData.get("project_id") || "").trim() || null,
    vendor_id: String(formData.get("vendor_id") || ""),
    parent_contractor_id: String(formData.get("parent_contractor_id") || "").trim() || null,
    po_number: poNumber,
    pr_number: String(formData.get("pr_number") || "").trim() || null,
    rfq_number: String(formData.get("rfq_number") || "").trim() || null,
    po_date: String(formData.get("po_date") || ""),
    approval_date: String(formData.get("approval_date") || "").trim() || null,
    approved_by_text: String(formData.get("approved_by_text") || "").trim() || null,
    currency_id: String(formData.get("currency_id") || ""),
    original_value: parseNum("original_value"),
    approved_variations: parseNum("approved_variations"),
    payment_terms: String(formData.get("payment_terms") || "").trim() || null,
    delivery_terms: String(formData.get("delivery_terms") || "").trim() || null,
    delivery_due_date: String(formData.get("delivery_due_date") || "").trim() || null,
    status: String(formData.get("status") || "active"),
    is_historical: formData.get("is_historical") === "on",
    historical_source: String(formData.get("historical_source") || "").trim() || null,
    historical_imported_at: formData.get("is_historical") === "on" ? new Date().toISOString() : null,
    historical_imported_by: formData.get("is_historical") === "on" ? user.id : null,
    notes: String(formData.get("notes") || "").trim() || null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/purchase-orders");
  redirect("/purchase-orders?created=1");
}
