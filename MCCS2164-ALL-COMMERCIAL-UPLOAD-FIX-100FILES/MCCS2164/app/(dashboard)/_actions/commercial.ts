"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, requireSuperAdmin } from "@/lib/mccs/auth";
import { currentAccess, requireReviewAuthority } from "@/lib/mccs/invoice-auth";
import { ensureVendorDriveFolder, ensureProjectDriveStructure, ensurePOFolder, ensureInvoiceFolder, uploadFileToGoogleDrive, sanitizeDriveName, ensureGoogleFolderPath, moveGoogleDriveFile, updateGoogleDriveFile, deleteGoogleDriveFile } from "@/lib/google/drive";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

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

async function saveCommercialFile({
  supabase,
  userId,
  file,
  folderParts,
  projectId,
  vendorId,
  purchaseOrderId,
  invoiceId,
  milestoneId,
  documentTitle,
  documentType,
  documentCategory,
  isHistorical = false,
}: {
  supabase: any;
  userId: string;
  file: File;
  folderParts: string[];
  projectId?: string | null;
  vendorId?: string | null;
  purchaseOrderId?: string | null;
  invoiceId?: string | null;
  milestoneId?: string | null;
  documentTitle: string;
  documentType: string;
  documentCategory: string;
  isHistorical?: boolean;
}) {
  if (!(file instanceof File) || file.size <= 0) return null;
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  const baseName = sanitizeDriveName(documentTitle || file.name.replace(/\.[^.]+$/, ""));
  const uploaded = await uploadFileToGoogleDrive(folderParts, `${baseName}${extension}`, await file.arrayBuffer(), file.type || "application/octet-stream");
  // Document metadata is a server-side write after the user has already been
  // authenticated by the calling action. Use the service-role client only for
  // this insert so table RLS cannot orphan a successfully uploaded Drive file.
  const documentDb = adminClient();
  const { data, error } = await documentDb.from("documents").insert({
    project_id: projectId || null,
    vendor_id: vendorId || null,
    purchase_order_id: purchaseOrderId || null,
    invoice_id: invoiceId || null,
    milestone_id: milestoneId || null,
    document_title: documentTitle || uploaded.name,
    document_type: documentType,
    document_category: documentCategory,
    file_name: uploaded.name,
    revision: null,
    is_historical: isHistorical,
    uploaded_by: userId,
    mime_type: file.type || "application/octet-stream",
    file_size: uploaded.size,
    storage_provider: "google_drive",
    storage_status: "uploaded",
    storage_uploaded_at: new Date().toISOString(),
    google_drive_file_id: uploaded.fileId,
    google_drive_folder_id: uploaded.parentId,
    google_drive_path: uploaded.path,
    google_drive_web_url: uploaded.webViewLink,
  }).select("id").single();
  if (error) throw new Error(`Document metadata save failed: ${error.message}`);
  return data;
}

export async function createMainVendor(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const vendorName = text(formData, "vendor_name");
  if (!vendorName) redirect("/vendors/main/new?error=Vendor%20name%20is%20required");

  const { data: vendor, error } = await supabase.from("vendors").insert({
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
  }).select("id").single();

  if (error || !vendor) redirect(`/vendors/main/new?error=${encodeURIComponent(error?.message || "Unable to create vendor")}`);

  let warning = "";
  try {
    const folder = await ensureVendorDriveFolder(vendorName);
    await supabase.from("vendors").update({ google_drive_folder_id: folder.id, google_drive_path: folder.path }).eq("id", vendor.id);
  } catch (driveError) {
    warning = driveError instanceof Error ? driveError.message : "Google Drive vendor folder could not be created.";
  }

  revalidatePath("/vendors");
  redirect(`/vendors?created=main${warning ? `&warning=${encodeURIComponent(warning)}` : ""}`);
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

  const poNumber = text(formData, "po_number").trim();
  const vendorId = text(formData, "vendor_id");
  const projectId = text(formData, "project_id");
  const currencyId = text(formData, "currency_id");
  const poDate = text(formData, "po_date");

  if (!poNumber || !vendorId || !projectId || !currencyId || !poDate) {
    redirect("/purchase-orders/new?error=PO%20number%2C%20vendor%2C%20commercial%20project%2C%20currency%20and%20PO%20date%20are%20required");
  }

  // Protect the unique PO number and give a business-friendly response instead of
  // exposing PostgreSQL's raw duplicate-key error. This also prevents an accidental
  // double-submit from creating a second request for the same PO number.
  const { data: existingPO } = await supabase
    .from("purchase_orders")
    .select("id,po_number,is_deleted")
    .ilike("po_number", poNumber)
    .limit(1)
    .maybeSingle();
  if (existingPO) {
    if (existingPO.is_deleted) {
      redirect(`/purchase-orders/new?error=${encodeURIComponent(`PO ${existingPO.po_number} already exists in MCCS audit history as a deleted record. PO numbers cannot be reused; restore the existing record or use the correct new PO number.`)}`);
    }
    redirect(`/purchase-orders/${existingPO.id}?warning=${encodeURIComponent(`PO ${existingPO.po_number} already exists. MCCS opened the existing PO instead of creating a duplicate.`)}`);
  }

  const historical = formData.get("is_historical") === "on";
  const [{ data: vendor }, { data: project }] = await Promise.all([
    supabase.from("vendors").select("vendor_name").eq("id", vendorId).maybeSingle(),
    supabase.from("projects").select("project_name,vendor_id").eq("id", projectId).maybeSingle(),
  ]);
  if (!vendor?.vendor_name || !project?.project_name) redirect("/purchase-orders/new?error=Vendor%20or%20commercial%20project%20could%20not%20be%20found");
  if (project.vendor_id && String(project.vendor_id) !== vendorId) redirect("/purchase-orders/new?error=Selected%20commercial%20project%20does%20not%20belong%20to%20the%20selected%20vendor");

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({
      project_id: projectId,
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
      quote_ref: nullable(formData, "quote_ref"),
      quote_date: nullable(formData, "quote_date"),
      incoterm: nullable(formData, "incoterm"),
      origin_of_goods: nullable(formData, "origin_of_goods"),
      warranty: nullable(formData, "warranty"),
      shipping_address: nullable(formData, "shipping_address"),
      billing_address: nullable(formData, "billing_address"),
      other_instruction: nullable(formData, "other_instruction"),
      discount: num(formData, "discount"),
      extra_cost: num(formData, "extra_cost"),
      prepared_by: nullable(formData, "prepared_by"),
      initial_po_date: nullable(formData, "initial_po_date") || poDate,
      revised_po_date: nullable(formData, "revised_po_date"),
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

  if (error || !po) {
    if (error?.code === "23505") {
      const { data: duplicate } = await supabase.from("purchase_orders").select("id,po_number,is_deleted").ilike("po_number", poNumber).limit(1).maybeSingle();
      if (duplicate && !duplicate.is_deleted) redirect(`/purchase-orders/${duplicate.id}?warning=${encodeURIComponent(`PO ${duplicate.po_number} already exists. MCCS opened the existing PO instead of creating a duplicate.`)}`);
      redirect(`/purchase-orders/new?error=${encodeURIComponent(`PO ${poNumber} already exists and cannot be created twice.`)}`);
    }
    redirect(`/purchase-orders/new?error=${encodeURIComponent(error?.message || "Unable to create PO")}`);
  }

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
    if (milestoneError) redirect(`/purchase-orders/${po.id}?warning=${encodeURIComponent("PO created, but milestone save failed: " + milestoneError.message)}`);
  }

  const initialItemDescription = text(formData, "item_description");
  if (initialItemDescription) {
    const qty = num(formData, "item_quantity") || 1;
    const unitCost = num(formData, "item_unit_cost");
    const { error: itemError } = await supabase.from("purchase_order_items").insert({
      purchase_order_id: po.id, sequence_no: 1, item_code: nullable(formData,"item_code"),
      description: initialItemDescription, site: nullable(formData,"item_site"), uom: nullable(formData,"item_uom"),
      quantity: qty, unit_cost: unitCost, created_by: user.id
    });
    if (itemError) redirect(`/purchase-orders/${po.id}?warning=${encodeURIComponent("PO created, but first item save failed: " + itemError.message)}`);
  }

  let warning = "";
  try {
    const poFolder = await ensurePOFolder(vendor.vendor_name, project.project_name, poNumber);
    await supabase.from("purchase_orders").update({ google_drive_folder_id: poFolder.id, google_drive_path: poFolder.path }).eq("id", po.id);

    // Attachments are uploaded by the browser after PO creation using the
    // resumable Google Drive API. This keeps large files out of Server Actions.
  } catch (driveError) {
    warning = driveError instanceof Error ? driveError.message : "Google Drive PO folder or document upload failed.";
  }

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${po.id}`);
  revalidatePath("/documents");
  return { ok:true, id:String(po.id), projectId, vendorId, purchaseOrderId:String(po.id), warning };
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
  const reason = nullable(formData,"delete_reason") || "Deleted by Super Admin";
  const {data:row}=await supabase.from("purchase_orders").select("po_number").eq("id",poId).maybeSingle();
  const { error } = await supabase.from("purchase_orders").update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
    delete_reason: reason,
    status: "cancelled",
  }).eq("id", poId);
  if (error) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(error.message)}`);
  await writeDeleteAudit(supabase,user.id,"purchase_order",poId,row?.po_number||poId,reason);
  revalidatePath("/purchase-orders");revalidatePath("/dashboard");revalidatePath("/reports");
  redirect("/purchase-orders?deleted=1");
}



export async function restorePurchaseOrder(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const poId = text(formData, "po_id");
  if (!poId) redirect("/purchase-orders?view=history&error=PO%20ID%20is%20required");

  const { data: row } = await supabase.from("purchase_orders").select("po_number,is_deleted").eq("id", poId).maybeSingle();
  if (!row) redirect("/purchase-orders?view=history&error=Purchase%20Order%20not%20found");
  const now = new Date().toISOString();
  const { error } = await supabase.from("purchase_orders").update({
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
    status: "active",
    updated_at: now,
    updated_by: user.id,
  }).eq("id", poId);
  if (error) redirect(`/purchase-orders?view=history&error=${encodeURIComponent(error.message)}`);
  try { await supabase.from("audit_logs").insert({actor_user_id:user.id,entity_type:"purchase_order",entity_id:poId,action:"RESTORE_PURCHASE_ORDER",after_data:{po_number:row.po_number,restored_at:now}}); } catch {}
  revalidatePath("/purchase-orders"); revalidatePath("/dashboard"); revalidatePath("/reports");
  redirect("/purchase-orders?restored=1");
}

export async function purgeDeletedPurchaseOrder(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const poId = text(formData, "po_id");
  const reason = text(formData, "delete_reason") || "Permanent test-data purge by Super Admin";
  if (!poId) redirect("/purchase-orders?view=history&error=PO%20ID%20is%20required");

  const { data: row } = await supabase.from("purchase_orders").select("id,po_number,is_deleted").eq("id", poId).maybeSingle();
  if (!row) redirect("/purchase-orders?view=history&error=Purchase%20Order%20not%20found");
  if (!row.is_deleted) redirect("/purchase-orders?error=Only%20soft-deleted%20POs%20can%20be%20permanently%20purged");

  const checks = await Promise.all([
    supabase.from("payment_milestones").select("id", { count: "exact", head: true }).eq("purchase_order_id", poId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("purchase_order_id", poId),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("purchase_order_id", poId),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("purchase_order_id", poId),
    supabase.from("purchase_order_items").select("id", { count: "exact", head: true }).eq("purchase_order_id", poId),
  ]);
  const labels = ["milestones","invoices","payments","documents","PO items"];
  const linked = checks.map((r:any,i)=>({label:labels[i],count:Number(r.count||0)})).filter(x=>x.count>0);
  if (linked.length) {
    const summary = linked.map(x=>`${x.count} ${x.label}`).join(", ");
    redirect(`/purchase-orders?view=history&error=${encodeURIComponent(`Permanent purge blocked: ${row.po_number} still has linked records (${summary}). Keep it in audit history or clean the linked test records first.`)}`);
  }

  const before = { po_number: row.po_number, purge_reason: reason, purged_at: new Date().toISOString() };
  const { error } = await supabase.from("purchase_orders").delete().eq("id", poId).eq("is_deleted", true);
  if (error) redirect(`/purchase-orders?view=history&error=${encodeURIComponent(error.message)}`);
  try { await supabase.from("audit_logs").insert({actor_user_id:user.id,entity_type:"purchase_order_purge",entity_id:poId,action:"PURGE_TEST_PURCHASE_ORDER",before_data:before,after_data:{permanently_deleted:true}}); } catch {}
  revalidatePath("/purchase-orders"); revalidatePath("/dashboard"); revalidatePath("/reports");
  redirect("/purchase-orders?view=history&purged=1");
}

export async function createProject(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();

  const projectCode = text(formData, "project_code");
  const projectName = text(formData, "project_name");
  const vendorId = text(formData, "vendor_id");

  if (!vendorId || !projectCode || !projectName) {
    redirect("/projects/new?error=Vendor%2C%20project%20code%20and%20project%20name%20are%20required");
  }

  const { data: vendor } = await supabase.from("vendors").select("vendor_name").eq("id", vendorId).maybeSingle();
  if (!vendor?.vendor_name) redirect("/projects/new?error=Selected%20vendor%20could%20not%20be%20found");

  const { data: project, error } = await supabase.from("projects").insert({
    vendor_id: vendorId,
    project_code: projectCode,
    project_name: projectName,
    description: nullable(formData, "description"),
    start_date: nullable(formData, "start_date"),
    planned_finish_date: nullable(formData, "planned_finish_date"),
    is_active: true,
    created_by: user.id,
  }).select("id").single();

  if (error || !project) {
    redirect(`/projects/new?error=${encodeURIComponent(error?.message || "Unable to create project")}`);
  }

  let warning = "";
  try {
    const folder = await ensureProjectDriveStructure(vendor.vendor_name, projectName);
    await supabase.from("projects").update({ google_drive_folder_id: folder.id, google_drive_path: folder.path }).eq("id", project.id);
  } catch (driveError) {
    warning = driveError instanceof Error ? driveError.message : "Google Drive project folder structure could not be created.";
  }

  revalidatePath("/projects");
  revalidatePath("/purchase-orders/new");
  redirect(`/projects?created=1${warning ? `&warning=${encodeURIComponent(warning)}` : ""}`);
}

export async function deactivateProject(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const projectId = text(formData, "project_id");

  const { error } = await supabase
    .from("projects")
    .update({ is_active: false })
    .eq("id", projectId);

  if (error) {
    redirect(`/projects?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/projects");
  revalidatePath("/purchase-orders/new");
  redirect("/projects?deactivated=1");
}

export async function createInvoice(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const historical = formData.get("is_historical") === "on";
  const reviewerId = nullable(formData,"assigned_reviewer_id");
  const invoiceNumber = text(formData,"invoice_number");
  const purchaseOrderId = text(formData,"purchase_order_id");
  const vendorId = text(formData,"vendor_id");
  const projectId = text(formData,"project_id");
  const now = new Date().toISOString();

  const { data: po } = await supabase.from("purchase_orders").select("id,po_number,project_id,vendor_id").eq("id", purchaseOrderId).maybeSingle();
  if (!po) redirect("/invoices/new?error=Selected%20PO%20could%20not%20be%20found");
  const selectedMilestoneId = nullable(formData,"milestone_id");
  if (selectedMilestoneId) {
    const { data: ms } = await supabase.from("payment_milestones").select("purchase_order_id").eq("id", selectedMilestoneId).eq("is_deleted", false).maybeSingle();
    if (!ms || String(ms.purchase_order_id) !== purchaseOrderId) redirect("/invoices/new?error=Selected%20milestone%20does%20not%20belong%20to%20the%20selected%20PO");
  }
  const effectiveVendorId = vendorId || String(po.vendor_id || "");
  const [{ data: vendor }, { data: project }] = await Promise.all([
    supabase.from("vendors").select("vendor_name").eq("id", effectiveVendorId).maybeSingle(),
    supabase.from("projects").select("project_name").eq("id", projectId || po.project_id).maybeSingle(),
  ]);
  if (!vendor?.vendor_name || !project?.project_name) redirect("/invoices/new?error=Vendor%20or%20commercial%20project%20could%20not%20be%20resolved%20from%20the%20PO");

  const { data: created, error } = await supabase.from("invoices").insert({
    purchase_order_id: purchaseOrderId,
    project_id: projectId || po.project_id || null,
    vendor_id: effectiveVendorId,
    payment_milestone_id: selectedMilestoneId,
    invoice_number: invoiceNumber,
    invoice_date: text(formData,"invoice_date"),
    received_date: nullable(formData,"received_date"),
    currency_id: text(formData,"currency_id"),
    invoice_amount: num(formData,"invoice_amount"),
    certified_amount: num(formData,"certified_amount"),
    status: "received",
    due_date: nullable(formData,"due_date"),
    verification_notes: nullable(formData,"verification_notes"),
    assigned_reviewer_id: reviewerId,
    workflow_status: reviewerId ? "under_verification" : "received",
    submitted_for_review_at: reviewerId ? now : null,
    verification_ref: `MCCS-IV-${invoiceNumber.replace(/[^A-Za-z0-9]+/g,"-").toUpperCase()}`,
    is_historical: historical,
    historical_source: nullable(formData,"historical_source"),
    historical_imported_at: historical ? now : null,
    historical_imported_by: historical ? user.id : null,
    created_by: user.id,
  }).select("id").single();
  if(error || !created) redirect(`/invoices/new?error=${encodeURIComponent(error?.message || "Unable to create invoice")}`);

  if(reviewerId){
    await supabase.from("invoice_approvals").insert({invoice_id:created.id,stage:"technical_verification",action:"assigned",assigned_to:reviewerId,actor_user_id:user.id,comments:"Assigned during invoice registration"});
  }

  let warning = "";
  try {
    const invoiceFolder = await ensureInvoiceFolder(vendor.vendor_name, project.project_name, invoiceNumber);
    await supabase.from("invoices").update({ google_drive_folder_id: invoiceFolder.id, google_drive_path: invoiceFolder.path }).eq("id", created.id);
    // Attachments are uploaded by the browser after invoice creation using the
    // resumable Google Drive API. This avoids Server Action request-size limits.
  } catch (driveError) {
    warning = driveError instanceof Error ? driveError.message : "Google Drive invoice folder or attachment upload failed.";
  }

  revalidatePath("/invoices"); revalidatePath("/invoices/reviews"); revalidatePath("/dashboard"); revalidatePath("/documents");
  return { ok:true, id:String(created.id), projectId:String(projectId || po.project_id || ""), vendorId:effectiveVendorId, purchaseOrderId, invoiceId:String(created.id), milestoneId:selectedMilestoneId, historical, warning };
}

export async function updateInvoice(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const id=text(formData,"invoice_id"); const historical=formData.get("is_historical")==="on";
  const { error }=await supabase.from("invoices").update({
    purchase_order_id:text(formData,"purchase_order_id"), project_id:nullable(formData,"project_id"), vendor_id:text(formData,"vendor_id"), payment_milestone_id:nullable(formData,"milestone_id"),
    invoice_number:text(formData,"invoice_number"), invoice_date:text(formData,"invoice_date"), received_date:nullable(formData,"received_date"),
    currency_id:text(formData,"currency_id"), invoice_amount:num(formData,"invoice_amount"), certified_amount:num(formData,"certified_amount"),
    status:text(formData,"status")||"received", due_date:nullable(formData,"due_date"), verification_notes:nullable(formData,"verification_notes"),
    is_historical:historical, historical_source:nullable(formData,"historical_source"), updated_at:new Date().toISOString(), updated_by:user.id
  }).eq("id",id);
  if(error) redirect(`/invoices/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/invoices"); revalidatePath("/dashboard"); redirect("/invoices?updated=1");
}

export async function createPayment(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const historical = formData.get("is_historical") === "on";
  const purchaseOrderId = text(formData, "purchase_order_id");
  const invoiceId = nullable(formData, "invoice_id");
  const milestoneId = nullable(formData, "payment_milestone_id");
  if (!purchaseOrderId) redirect("/payments/new?error=PO%20is%20required");

  if (invoiceId) {
    const { data: inv } = await supabase.from("invoices").select("purchase_order_id").eq("id", invoiceId).maybeSingle();
    if (!inv || String(inv.purchase_order_id) !== purchaseOrderId) redirect("/payments/new?error=Selected%20invoice%20does%20not%20belong%20to%20the%20selected%20PO");
  }
  if (milestoneId) {
    const { data: ms } = await supabase.from("payment_milestones").select("purchase_order_id").eq("id", milestoneId).eq("is_deleted", false).maybeSingle();
    if (!ms || String(ms.purchase_order_id) !== purchaseOrderId) redirect("/payments/new?error=Selected%20milestone%20does%20not%20belong%20to%20the%20selected%20PO");
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    payment_milestone_id: milestoneId,
    purchase_order_id: purchaseOrderId,
    currency_id: text(formData, "currency_id"),
    payment_date: text(formData, "payment_date"),
    paid_amount: num(formData, "paid_amount"),
    payment_reference: nullable(formData, "payment_reference"),
    bank_reference: nullable(formData, "bank_reference"),
    notes: nullable(formData, "notes"),
    is_historical: historical,
    historical_source: nullable(formData, "historical_source"),
    historical_imported_at: historical ? new Date().toISOString() : null,
    historical_imported_by: historical ? user.id : null,
    created_by: user.id,
  });
  if (error) redirect(`/payments/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/payments"); revalidatePath("/dashboard"); revalidatePath("/payment-milestones");
  redirect("/payments?created=1");
}

export async function updatePayment(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const id = text(formData, "payment_id");
  const historical = formData.get("is_historical") === "on";
  const purchaseOrderId = text(formData, "purchase_order_id");
  const invoiceId = nullable(formData, "invoice_id");
  const milestoneId = nullable(formData, "payment_milestone_id");
  if (invoiceId) {
    const { data: inv } = await supabase.from("invoices").select("purchase_order_id").eq("id", invoiceId).maybeSingle();
    if (!inv || String(inv.purchase_order_id) !== purchaseOrderId) redirect(`/payments/${id}/edit?error=Selected%20invoice%20does%20not%20belong%20to%20the%20selected%20PO`);
  }
  if (milestoneId) {
    const { data: ms } = await supabase.from("payment_milestones").select("purchase_order_id").eq("id", milestoneId).eq("is_deleted", false).maybeSingle();
    if (!ms || String(ms.purchase_order_id) !== purchaseOrderId) redirect(`/payments/${id}/edit?error=Selected%20milestone%20does%20not%20belong%20to%20the%20selected%20PO`);
  }
  const { error } = await supabase.from("payments").update({
    invoice_id: invoiceId,
    payment_milestone_id: milestoneId,
    purchase_order_id: purchaseOrderId,
    currency_id: text(formData, "currency_id"),
    payment_date: text(formData, "payment_date"),
    paid_amount: num(formData, "paid_amount"),
    payment_reference: nullable(formData, "payment_reference"),
    bank_reference: nullable(formData, "bank_reference"),
    notes: nullable(formData, "notes"),
    is_historical: historical,
    historical_source: nullable(formData, "historical_source"),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }).eq("id", id);
  if (error) redirect(`/payments/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/payments"); revalidatePath("/dashboard"); revalidatePath("/payment-milestones");
  redirect("/payments?updated=1");
}

export async function updateMilestone(formData: FormData) {
 const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"milestone_id"); const poId=text(formData,"purchase_order_id"); const pctRaw=text(formData,"percentage"); const fixedRaw=text(formData,"fixed_amount");
 const {data:po}=await supabase.from("purchase_orders").select("current_value").eq("id",poId).maybeSingle();
 const pct=pctRaw?Number(pctRaw):null; const fixed=pct!=null?Number(po?.current_value||0)*pct/100:(fixedRaw?Number(fixedRaw.replace(/,/g,"")):null);
 const {error}=await supabase.from("payment_milestones").update({milestone_name:text(formData,"milestone_name"),percentage:pct,fixed_amount:fixed,planned_due_date:nullable(formData,"planned_due_date"),payment_due_date:nullable(formData,"payment_due_date"),status:text(formData,"status")||"planned",is_historical:formData.get("is_historical")==="on",notes:nullable(formData,"notes"),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/payment-milestones/${id}/edit?error=${encodeURIComponent(error.message)}`); revalidatePath("/payment-milestones");revalidatePath(`/purchase-orders/${poId}`);revalidatePath("/dashboard");redirect("/payment-milestones?updated=1");
}


export async function bulkUpdateMilestones(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const vendorId = text(formData, "vendor_id");
  const milestoneIds = formData.getAll("milestone_id").map((v) => String(v)).filter(Boolean);
  if (!vendorId) redirect("/payment-milestones?error=" + encodeURIComponent("Select a supplier or contractor before using bulk edit."));
  if (!milestoneIds.length) redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&error=${encodeURIComponent("No active milestones were found for this supplier.")}`);

  const { data: milestones, error: readError } = await supabase
    .from("payment_milestones")
    .select("id,purchase_order_id")
    .in("id", milestoneIds)
    .eq("is_deleted", false);
  if (readError) redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&error=${encodeURIComponent(readError.message)}`);

  const poIds = [...new Set((milestones ?? []).map((m: any) => String(m.purchase_order_id)).filter(Boolean))];
  const { data: pos, error: poError } = poIds.length
    ? await supabase.from("purchase_orders").select("id,current_value,vendor_id").in("id", poIds).eq("is_deleted", false)
    : { data: [], error: null } as any;
  if (poError) redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&error=${encodeURIComponent(poError.message)}`);

  const poMap = new Map<string, any>((pos ?? []).map((p: any) => [String(p.id), p]));
  for (const m of milestones ?? []) {
    const po = poMap.get(String((m as any).purchase_order_id));
    if (!po || String(po.vendor_id) !== vendorId) {
      redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&error=${encodeURIComponent("One or more milestones do not belong to the selected supplier. No changes were saved.")}`);
    }
  }

  const updates: any[] = [];
  const totalsByPo = new Map<string, number>();
  for (const id of milestoneIds) {
    const m = (milestones ?? []).find((x: any) => String(x.id) === id);
    if (!m) continue;
    const po = poMap.get(String((m as any).purchase_order_id));
    const pctRaw = text(formData, `percentage_${id}`);
    const fixedRaw = text(formData, `fixed_amount_${id}`);
    const pct = pctRaw === "" ? null : Number(pctRaw);
    if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&error=${encodeURIComponent("Each milestone percentage must be between 0 and 100.")}`);
    }
    if (pct != null) totalsByPo.set(String((m as any).purchase_order_id), (totalsByPo.get(String((m as any).purchase_order_id)) || 0) + pct);
    const fixed = pct != null ? Number(po?.current_value || 0) * pct / 100 : (fixedRaw ? Number(fixedRaw.replace(/,/g, "")) : null);
    updates.push({
      id,
      purchase_order_id: String((m as any).purchase_order_id),
      milestone_name: text(formData, `milestone_name_${id}`),
      percentage: pct,
      fixed_amount: Number.isFinite(Number(fixed)) ? fixed : null,
      planned_due_date: nullable(formData, `planned_due_date_${id}`),
      payment_due_date: nullable(formData, `payment_due_date_${id}`),
      status: text(formData, `status_${id}`) || "planned",
    });
  }

  for (const [poId, total] of totalsByPo.entries()) {
    if (total > 100.0001) {
      const po = poMap.get(poId);
      redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&error=${encodeURIComponent(`Milestone allocation for this PO exceeds 100% (${total.toFixed(2)}%). Please correct the percentages before saving.`)}`);
    }
  }

  const now = new Date().toISOString();
  for (const row of updates) {
    const { error } = await supabase.from("payment_milestones").update({
      milestone_name: row.milestone_name,
      percentage: row.percentage,
      fixed_amount: row.fixed_amount,
      planned_due_date: row.planned_due_date,
      payment_due_date: row.payment_due_date,
      status: row.status,
      updated_at: now,
      updated_by: user.id,
    }).eq("id", row.id).eq("is_deleted", false);
    if (error) redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&error=${encodeURIComponent(`Milestone update failed: ${error.message}`)}`);
  }

  revalidatePath("/payment-milestones");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/payment-milestones?vendor=${encodeURIComponent(vendorId)}&bulk_updated=1`);
}

export async function updatePurchaseOrderDetails(formData: FormData){
 const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"po_id");
 const {error}=await supabase.from("purchase_orders").update({project_id:nullable(formData,"project_id"),vendor_id:text(formData,"vendor_id"),parent_contractor_id:nullable(formData,"parent_contractor_id"),po_number:text(formData,"po_number"),pr_number:nullable(formData,"pr_number"),rfq_number:nullable(formData,"rfq_number"),po_date:text(formData,"po_date"),approval_date:nullable(formData,"approval_date"),approved_by_text:nullable(formData,"approved_by_text"),currency_id:text(formData,"currency_id"),original_value:num(formData,"original_value"),payment_terms:nullable(formData,"payment_terms"),delivery_terms:nullable(formData,"delivery_terms"),delivery_due_date:nullable(formData,"delivery_due_date"),quote_ref:nullable(formData,"quote_ref"),quote_date:nullable(formData,"quote_date"),incoterm:nullable(formData,"incoterm"),origin_of_goods:nullable(formData,"origin_of_goods"),warranty:nullable(formData,"warranty"),shipping_address:nullable(formData,"shipping_address"),billing_address:nullable(formData,"billing_address"),other_instruction:nullable(formData,"other_instruction"),discount:num(formData,"discount"),extra_cost:num(formData,"extra_cost"),prepared_by:nullable(formData,"prepared_by"),initial_po_date:nullable(formData,"initial_po_date"),revised_po_date:nullable(formData,"revised_po_date"),status:text(formData,"status")||"active",is_historical:formData.get("is_historical")==="on",historical_source:nullable(formData,"historical_source"),notes:nullable(formData,"notes"),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/purchase-orders/${id}/edit?error=${encodeURIComponent(error.message)}`);

 const milestoneCount=Number(text(formData,"milestone_count")||"0");
 const rows:any[]=[];
 let totalPct=0;
 for(let i=0;i<milestoneCount;i++){
   const name=text(formData,`milestone_name_${i}`); if(!name) continue;
   const milestoneId=nullable(formData,`milestone_id_${i}`);
   const pctRaw=text(formData,`milestone_percentage_${i}`); const amountRaw=text(formData,`milestone_amount_${i}`);
   const pct=pctRaw?Number(pctRaw):null; if(pct!=null&&Number.isFinite(pct)) totalPct+=pct;
   rows.push({id:milestoneId,name,pct,amount:amountRaw?Number(amountRaw.replace(/,/g,"")):null,due:nullable(formData,`milestone_due_${i}`),paymentDue:nullable(formData,`milestone_payment_due_${i}`),status:text(formData,`milestone_status_${i}`)||"planned",sequence:i+1});
 }
 if(totalPct>100.0001) redirect(`/purchase-orders/${id}/edit?error=${encodeURIComponent(`Milestone percentages total ${totalPct.toFixed(2)}%. Total allocation cannot exceed 100%.`)}`);
 const now=new Date().toISOString();
 for(const row of rows){
   const payload={milestone_name:row.name,percentage:row.pct,fixed_amount:row.amount,planned_due_date:row.due,payment_due_date:row.paymentDue,status:row.status,sequence_no:row.sequence,updated_at:now,updated_by:user.id};
   if(row.id){const r=await supabase.from("payment_milestones").update(payload).eq("id",row.id).eq("purchase_order_id",id).eq("is_deleted",false);if(r.error)redirect(`/purchase-orders/${id}/edit?error=${encodeURIComponent(`Milestone update failed: ${r.error.message}`)}`)}
   else {const r=await supabase.from("payment_milestones").insert({...payload,purchase_order_id:id,verification_required:true,is_historical:formData.get("is_historical")==="on",created_by:user.id});if(r.error)redirect(`/purchase-orders/${id}/edit?error=${encodeURIComponent(`New milestone save failed: ${r.error.message}`)}`)}
 }
 revalidatePath("/purchase-orders");revalidatePath(`/purchase-orders/${id}`);revalidatePath("/payment-milestones");revalidatePath("/dashboard");redirect(`/purchase-orders/${id}?updated=1`);
}

export async function updateVendor(formData: FormData){
 const {supabase,user}=await requireSuperAdmin();const id=text(formData,"vendor_id");
 const {error}=await supabase.from("vendors").update({vendor_code:nullable(formData,"vendor_code"),vendor_name:text(formData,"vendor_name"),legal_name:nullable(formData,"legal_name"),relationship_type:text(formData,"relationship_type")||"direct_contractor",parent_vendor_id:nullable(formData,"parent_vendor_id"),country:nullable(formData,"country"),address:nullable(formData,"address"),contact_person:nullable(formData,"contact_person"),email:nullable(formData,"email"),phone:nullable(formData,"phone"),tax_number:nullable(formData,"tax_number"),default_currency_id:nullable(formData,"default_currency_id"),is_active:formData.get("is_active")==="on",notes:nullable(formData,"notes"),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/vendors/${id}/edit?error=${encodeURIComponent(error.message)}`);revalidatePath("/vendors");redirect("/vendors?updated=1");
}

export async function updateProject(formData: FormData){
 const {supabase,user}=await requireSuperAdmin();const id=text(formData,"project_id");
 const {error}=await supabase.from("projects").update({project_code:text(formData,"project_code"),project_name:text(formData,"project_name"),description:nullable(formData,"description"),start_date:nullable(formData,"start_date"),planned_finish_date:nullable(formData,"planned_finish_date"),is_active:formData.get("is_active")==="on",updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/projects/${id}/edit?error=${encodeURIComponent(error.message)}`);revalidatePath("/projects");revalidatePath("/purchase-orders/new");redirect("/projects?updated=1");
}

export async function createDocumentMetadata(formData: FormData){
 const {supabase,user}=await requireSuperAdmin();const {error}=await supabase.from("documents").insert({project_id:nullable(formData,"project_id"),vendor_id:nullable(formData,"vendor_id"),purchase_order_id:nullable(formData,"purchase_order_id"),invoice_id:nullable(formData,"invoice_id"),milestone_id:nullable(formData,"milestone_id"),document_title:text(formData,"document_title"),document_type:text(formData,"document_type"),file_name:text(formData,"file_name"),revision:nullable(formData,"revision"),is_historical:formData.get("is_historical")==="on",uploaded_by:user.id,storage_provider:"metadata_only",storage_status:"metadata_only"});
 if(error) redirect(`/documents/new?error=${encodeURIComponent(error.message)}`);revalidatePath("/documents");redirect("/documents?created=1");
}


export async function assignInvoiceReviewer(formData: FormData){
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"invoice_id"), reviewer=text(formData,"reviewer_id");
  if(!id||!reviewer) redirect(`/invoices/${id}?error=Reviewer%20is%20required`);
  const now=new Date().toISOString();
  const {error}=await supabase.from("invoices").update({assigned_reviewer_id:reviewer,workflow_status:"under_verification",submitted_for_review_at:now,return_reason:null,updated_at:now,updated_by:user.id}).eq("id",id);
  if(error) redirect(`/invoices/${id}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("invoice_approvals").insert({invoice_id:id,stage:"technical_verification",action:"assigned",assigned_to:reviewer,actor_user_id:user.id,comments:nullable(formData,"comments")});
  revalidatePath("/invoices");revalidatePath(`/invoices/${id}`);revalidatePath("/invoices/reviews");redirect(`/invoices/${id}?assigned=1`);
}

export async function reviewInvoice(formData: FormData){
  const a=await requireReviewAuthority(); const {supabase,user}=a; const id=text(formData,"invoice_id"), action=text(formData,"review_action"), comments=nullable(formData,"comments");
  const {data:inv,error:loadError}=await supabase.from("invoices").select("assigned_reviewer_id,workflow_status").eq("id",id).maybeSingle();
  if(loadError||!inv) redirect(`/invoices/${id}?error=${encodeURIComponent(loadError?.message||"Invoice not found")}`);
  if(!a.isSuperAdmin && inv.assigned_reviewer_id!==user.id) redirect(`/invoices/${id}?error=This%20invoice%20is%20not%20assigned%20to%20you`);
  const now=new Date().toISOString();
  if(action==="approve"){
    const {error}=await supabase.from("invoices").update({workflow_status:"technical_approved",technical_approved_at:now,return_reason:null,updated_at:now,updated_by:user.id}).eq("id",id); if(error) redirect(`/invoices/${id}?error=${encodeURIComponent(error.message)}`);
    await supabase.from("invoice_approvals").insert({invoice_id:id,stage:"technical_verification",action:"approved",assigned_to:user.id,actor_user_id:user.id,comments});
  } else {
    const reason=comments||"Returned by reviewer"; const {error}=await supabase.from("invoices").update({workflow_status:"returned",returned_at:now,return_reason:reason,updated_at:now,updated_by:user.id}).eq("id",id); if(error) redirect(`/invoices/${id}?error=${encodeURIComponent(error.message)}`);
    await supabase.from("invoice_approvals").insert({invoice_id:id,stage:"technical_verification",action:"returned",assigned_to:user.id,actor_user_id:user.id,comments:reason});
  }
  revalidatePath("/invoices");revalidatePath(`/invoices/${id}`);revalidatePath("/invoices/reviews");redirect(`/invoices/${id}?reviewed=1`);
}

export async function finalApproveInvoice(formData: FormData){
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"invoice_id"), comments=nullable(formData,"comments"), now=new Date().toISOString();
  const {data:inv}=await supabase.from("invoices").select("workflow_status,invoice_amount,certified_amount").eq("id",id).maybeSingle();
  if(!inv) redirect(`/invoices/${id}?error=Invoice%20not%20found`);
  if(!["technical_approved","approved_for_payment"].includes(String(inv.workflow_status))) redirect(`/invoices/${id}?error=Technical%20approval%20is%20required%20before%20final%20acceptance`);
  const certified=Number(inv.certified_amount||0)>0?Number(inv.certified_amount):Number(inv.invoice_amount||0);
  const {error}=await supabase.from("invoices").update({workflow_status:"approved_for_payment",status:"approved",certified_amount:certified,commercial_verifier_id:user.id,final_approved_at:now,updated_at:now,updated_by:user.id}).eq("id",id);
  if(error) redirect(`/invoices/${id}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("invoice_approvals").insert({invoice_id:id,stage:"commercial_verification",action:"approved_for_payment",actor_user_id:user.id,comments});
  revalidatePath("/invoices");revalidatePath(`/invoices/${id}`);revalidatePath("/dashboard");redirect(`/invoices/${id}?approved=1`);
}

export async function returnInvoiceCommercial(formData: FormData){
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"invoice_id"), reason=text(formData,"comments")||"Returned by commercial verification",now=new Date().toISOString();
  const {error}=await supabase.from("invoices").update({workflow_status:"returned",status:"on_hold",returned_at:now,return_reason:reason,updated_at:now,updated_by:user.id}).eq("id",id); if(error) redirect(`/invoices/${id}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("invoice_approvals").insert({invoice_id:id,stage:"commercial_verification",action:"returned",actor_user_id:user.id,comments:reason});
  revalidatePath("/invoices");revalidatePath(`/invoices/${id}`);redirect(`/invoices/${id}?returned=1`);
}

export async function markInvoiceSubmittedToAP(formData: FormData){
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"invoice_id"),now=new Date().toISOString();
  const {data:inv}=await supabase.from("invoices").select("workflow_status").eq("id",id).maybeSingle(); if(!inv||inv.workflow_status!=="approved_for_payment") redirect(`/invoices/${id}?error=Invoice%20must%20be%20approved%20for%20payment%20first`);
  const {error}=await supabase.from("invoices").update({workflow_status:"submitted_to_ap",status:"submitted_to_ap",submitted_to_ap_at:now,updated_at:now,updated_by:user.id}).eq("id",id); if(error) redirect(`/invoices/${id}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("invoice_approvals").insert({invoice_id:id,stage:"accounts_payable",action:"released_to_ap_queue",actor_user_id:user.id,comments:nullable(formData,"comments")});
  revalidatePath("/invoices");revalidatePath(`/invoices/${id}`);revalidatePath("/dashboard");redirect(`/invoices/${id}?ap=1`);
}


export async function deleteInvoice(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const id = text(formData, "invoice_id");
  const reason = text(formData, "delete_reason") || "Deleted by Super Admin";

  if (!id) {
    redirect("/invoices?error=Invoice%20ID%20is%20required");
  }

  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select("id,invoice_number")
    .eq("id", id)
    .maybeSingle();

  if (readError || !invoice) {
    redirect(`/invoices?error=${encodeURIComponent(readError?.message || "Invoice not found")}`);
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("invoices")
    .update({
      is_deleted: true,
      deleted_at: now,
      deleted_by: user.id,
      delete_reason: reason,
      status: "cancelled",
      updated_at: now,
      updated_by: user.id,
    })
    .eq("id", id);

  if (error) {
    redirect(`/invoices/${id}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: user.id,
    entity_type: "invoice",
    entity_id: id,
    action: "DELETE_INVOICE",
    after_data: {
      invoice_number: invoice.invoice_number,
      delete_reason: reason,
    },
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect("/invoices?deleted=1");
}


export async function deleteProjectPackage(formData: FormData){
 const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"project_id"),reason=text(formData,"delete_reason")||"Deleted by Super Admin";
 const {data:row}=await supabase.from("projects").select("project_name").eq("id",id).maybeSingle();
 const {error}=await supabase.from("projects").update({is_deleted:true,is_active:false,deleted_at:new Date().toISOString(),deleted_by:user.id,delete_reason:reason}).eq("id",id);
 if(error) redirect(`/projects?error=${encodeURIComponent(error.message)}`); await writeDeleteAudit(supabase,user.id,"project",id,row?.project_name||id,reason);revalidatePath("/projects");revalidatePath("/purchase-orders/new");revalidatePath("/dashboard");revalidatePath("/reports");redirect("/projects?deleted=1");
}

export async function deleteVendorRecord(formData: FormData){
 const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"vendor_id"),reason=text(formData,"delete_reason")||"Deleted by Super Admin";
 const {data:row}=await supabase.from("vendors").select("vendor_name").eq("id",id).maybeSingle();
 const {error}=await supabase.from("vendors").update({is_deleted:true,is_active:false,deleted_at:new Date().toISOString(),deleted_by:user.id,delete_reason:reason}).eq("id",id);
 if(error) redirect(`/vendors?error=${encodeURIComponent(error.message)}`); await writeDeleteAudit(supabase,user.id,"vendor",id,row?.vendor_name||id,reason);revalidatePath("/vendors");revalidatePath("/dashboard");revalidatePath("/reports");redirect("/vendors?deleted=1");
}

export async function addPurchaseOrderItem(formData:FormData){
 const {supabase,user}=await requireSuperAdmin(); const poId=text(formData,"po_id");
 const {data:existing}=await supabase.from("purchase_order_items").select("sequence_no").eq("purchase_order_id",poId).order("sequence_no",{ascending:false}).limit(1);
 const quantity=num(formData,"quantity")||1,unitCost=num(formData,"unit_cost");
 const {error}=await supabase.from("purchase_order_items").insert({purchase_order_id:poId,sequence_no:Number(existing?.[0]?.sequence_no||0)+1,item_code:nullable(formData,"item_code"),description:text(formData,"description"),site:nullable(formData,"site"),uom:nullable(formData,"uom"),quantity,unit_cost:unitCost,created_by:user.id});
 if(error) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(error.message)}`); revalidatePath(`/purchase-orders/${poId}`);redirect(`/purchase-orders/${poId}?item=added`);
}

export async function deletePurchaseOrderItem(formData:FormData){
 const {supabase}=await requireSuperAdmin(); const poId=text(formData,"po_id"),itemId=text(formData,"item_id"); const {error}=await supabase.from("purchase_order_items").delete().eq("id",itemId);
 if(error) redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(error.message)}`); revalidatePath(`/purchase-orders/${poId}`);redirect(`/purchase-orders/${poId}?item=deleted`);
}

function importCell(v:any){if(v==null)return "";if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==="object"&&"text" in v)return String(v.text||"").trim();return String(v).trim()}
function importDate(v:any){if(!v)return null;if(v instanceof Date)return v.toISOString().slice(0,10);const s=importCell(v);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const d=new Date(s);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10)}
function sheetRows(ws:ExcelJS.Worksheet){const headers:string[]=[];ws.getRow(1).eachCell((c,i)=>headers[i-1]=importCell(c.value).toLowerCase().replace(/[^a-z0-9]+/g,"_"));const rows:any[]=[];ws.eachRow((row,n)=>{if(n===1)return;const o:any={};headers.forEach((h,i)=>{if(h)o[h]=row.getCell(i+1).value});if(Object.values(o).some(v=>importCell(v)))rows.push(o)});return rows}

export async function importHistoricalWorkbook(formData:FormData){
 const {supabase,user}=await requireSuperAdmin(); const file=formData.get("historical_workbook"); if(!(file instanceof File)||file.size===0)redirect("/admin/historical-import?error=Please%20select%20the%20MCCS%20historical%20workbook");
 const wb=new ExcelJS.Workbook(); try{await wb.xlsx.load(Buffer.from(await file.arrayBuffer()))}catch(e){redirect(`/admin/historical-import?error=${encodeURIComponent("Unable to read workbook: "+(e instanceof Error?e.message:"invalid Excel file"))}`)}
 try {
 const stats:any={vendors:0,projects:0,pos:0,milestones:0,invoices:0,payments:0}; const now=new Date().toISOString(); const source=importCell(formData.get("historical_source"))||file.name;
 const currencyMap=new Map<string,string>(); const {data:currencies}=await supabase.from("currencies").select("id,code");(currencies??[]).forEach((c:any)=>currencyMap.set(String(c.code).toUpperCase(),String(c.id)));
 const vendorMap=new Map<string,string>(); const projectMap=new Map<string,string>(); const poMap=new Map<string,string>(); const invoiceMap=new Map<string,string>();
 const vendorSheet=wb.getWorksheet("Vendors"); if(vendorSheet)for(const r of sheetRows(vendorSheet)){
   const code=importCell(r.vendor_code),name=importCell(r.vendor_name);if(!name)continue;let q=supabase.from("vendors").select("id");q=code?q.eq("vendor_code",code):q.eq("vendor_name",name);let {data:ex}=await q.maybeSingle();let id=ex?.id;
   const payload:any={vendor_code:code||null,vendor_name:name,legal_name:importCell(r.legal_name)||null,country:importCell(r.country)||null,address:importCell(r.address)||null,contact_person:importCell(r.contact_person)||null,email:importCell(r.email)||null,phone:importCell(r.phone)||null,is_active:true,notes:importCell(r.notes)||null};
   if(id)await supabase.from("vendors").update({...payload,updated_at:now,updated_by:user.id}).eq("id",id);else{const ins=await supabase.from("vendors").insert({...payload,relationship_type:"direct_contractor",created_by:user.id}).select("id").single();if(ins.error)throw new Error(`Vendor ${name}: ${ins.error.message}`);id=ins.data.id;stats.vendors++}
   vendorMap.set((code||name).toUpperCase(),String(id));
 }
 const projSheet=wb.getWorksheet("Projects_Packages"); if(projSheet)for(const r of sheetRows(projSheet)){
   const code=importCell(r.project_code),name=importCell(r.project_name),vkey=importCell(r.vendor_code).toUpperCase();if(!code||!name)continue;let vid=vendorMap.get(vkey);if(!vid&&vkey){const {data:v}=await supabase.from("vendors").select("id").eq("vendor_code",importCell(r.vendor_code)).maybeSingle();vid=v?.id}if(!vid)throw new Error(`Project ${code}: vendor_code is not found`);
   const {data:ex}=await supabase.from("projects").select("id").eq("project_code",code).maybeSingle();let id=ex?.id;const payload={vendor_id:vid,project_code:code,project_name:name,description:importCell(r.description)||null,start_date:importDate(r.start_date),planned_finish_date:importDate(r.planned_finish_date),is_active:true};
   if(id)await supabase.from("projects").update({...payload,updated_at:now,updated_by:user.id}).eq("id",id);else{const ins=await supabase.from("projects").insert({...payload,created_by:user.id}).select("id").single();if(ins.error)throw new Error(`Project ${code}: ${ins.error.message}`);id=ins.data.id;stats.projects++}projectMap.set(code.toUpperCase(),String(id));
 }
 const poSheet=wb.getWorksheet("Purchase_Orders"); if(poSheet)for(const r of sheetRows(poSheet)){
   const po=importCell(r.po_number),pcode=importCell(r.project_code).toUpperCase(),vcode=importCell(r.vendor_code).toUpperCase(),cc=importCell(r.currency_code).toUpperCase();if(!po)continue;let pid=projectMap.get(pcode),vid=vendorMap.get(vcode);if(!pid){const {data:x}=await supabase.from("projects").select("id,vendor_id").eq("project_code",importCell(r.project_code)).maybeSingle();pid=x?.id;vid=vid||x?.vendor_id}if(!vid){const {data:x}=await supabase.from("vendors").select("id").eq("vendor_code",importCell(r.vendor_code)).maybeSingle();vid=x?.id}const cid=currencyMap.get(cc);if(!pid||!vid||!cid)throw new Error(`PO ${po}: project, vendor or currency code is not found`);
   const payload:any={project_id:pid,vendor_id:vid,po_number:po,pr_number:importCell(r.pr_number)||null,rfq_number:importCell(r.rfq_number)||null,po_date:importDate(r.po_date)||new Date().toISOString().slice(0,10),currency_id:cid,original_value:Number(importCell(r.original_value).replace(/,/g,""))||0,approved_variations:0,status:importCell(r.status)||"active",payment_terms:importCell(r.payment_terms)||null,delivery_terms:importCell(r.delivery_terms)||null,delivery_due_date:importDate(r.delivery_due_date),incoterm:importCell(r.incoterm)||null,origin_of_goods:importCell(r.origin_of_goods)||null,warranty:importCell(r.warranty)||null,quote_ref:importCell(r.quote_ref)||null,quote_date:importDate(r.quote_date),prepared_by:importCell(r.prepared_by)||null,discount:Number(importCell(r.discount).replace(/,/g,""))||0,extra_cost:Number(importCell(r.extra_cost).replace(/,/g,""))||0,is_historical:true,historical_source:importCell(r.historical_source)||source,historical_imported_at:now,historical_imported_by:user.id};
   const {data:ex}=await supabase.from("purchase_orders").select("id").eq("po_number",po).maybeSingle();let id=ex?.id;if(id)await supabase.from("purchase_orders").update({...payload,updated_at:now,updated_by:user.id}).eq("id",id);else{const ins=await supabase.from("purchase_orders").insert({...payload,created_by:user.id}).select("id").single();if(ins.error)throw new Error(`PO ${po}: ${ins.error.message}`);id=ins.data.id;stats.pos++}poMap.set(po.toUpperCase(),String(id));
 }
 const msSheet=wb.getWorksheet("Milestones"); if(msSheet)for(const r of sheetRows(msSheet)){const po=importCell(r.po_number),name=importCell(r.milestone_name),poId=poMap.get(po.toUpperCase())||(await supabase.from("purchase_orders").select("id").eq("po_number",po).maybeSingle()).data?.id;if(!poId||!name)continue;const {data:ex}=await supabase.from("payment_milestones").select("id").eq("purchase_order_id",poId).eq("milestone_name",name).maybeSingle();const payload:any={purchase_order_id:poId,sequence_no:Number(importCell(r.sequence_no))||1,milestone_name:name,percentage:importCell(r.percentage)?Number(importCell(r.percentage)):null,fixed_amount:importCell(r.fixed_amount)?Number(importCell(r.fixed_amount).replace(/,/g,"")):null,planned_due_date:importDate(r.planned_due_date),payment_due_date:importDate(r.payment_due_date),status:importCell(r.status)||"planned",discipline:importCell(r.discipline)||null,is_historical:true};if(ex?.id)await supabase.from("payment_milestones").update({...payload,updated_at:now,updated_by:user.id}).eq("id",ex.id);else{const ins=await supabase.from("payment_milestones").insert({...payload,created_by:user.id});if(ins.error)throw new Error(`Milestone ${name}: ${ins.error.message}`);stats.milestones++}}
 const invSheet=wb.getWorksheet("Invoices"); if(invSheet)for(const r of sheetRows(invSheet)){const inv=importCell(r.invoice_number),po=importCell(r.po_number),poId=poMap.get(po.toUpperCase())||(await supabase.from("purchase_orders").select("id,vendor_id").eq("po_number",po).maybeSingle()).data?.id;if(!inv||!poId)continue;const {data:poRec}=await supabase.from("purchase_orders").select("vendor_id,currency_id").eq("id",poId).maybeSingle();const cid=currencyMap.get(importCell(r.currency_code).toUpperCase())||poRec?.currency_id;const payload:any={purchase_order_id:poId,vendor_id:poRec?.vendor_id,invoice_number:inv,invoice_date:importDate(r.invoice_date)||new Date().toISOString().slice(0,10),received_date:importDate(r.received_date),currency_id:cid,invoice_amount:Number(importCell(r.invoice_amount).replace(/,/g,""))||0,certified_amount:Number(importCell(r.certified_amount).replace(/,/g,""))||0,status:importCell(r.status)||"received",workflow_status:importCell(r.workflow_status)||"received",due_date:importDate(r.due_date),is_historical:true,historical_source:importCell(r.historical_source)||source,historical_imported_at:now,historical_imported_by:user.id};const {data:ex}=await supabase.from("invoices").select("id").eq("invoice_number",inv).maybeSingle();let id=ex?.id;if(id)await supabase.from("invoices").update({...payload,updated_at:now,updated_by:user.id}).eq("id",id);else{const ins=await supabase.from("invoices").insert({...payload,created_by:user.id}).select("id").single();if(ins.error)throw new Error(`Invoice ${inv}: ${ins.error.message}`);id=ins.data.id;stats.invoices++}invoiceMap.set(inv.toUpperCase(),String(id))}
 const paySheet=wb.getWorksheet("Payments"); if(paySheet)for(const r of sheetRows(paySheet)){const po=importCell(r.po_number),inv=importCell(r.invoice_number),poId=poMap.get(po.toUpperCase())||(await supabase.from("purchase_orders").select("id,currency_id").eq("po_number",po).maybeSingle()).data?.id;if(!poId)continue;const {data:poRec}=await supabase.from("purchase_orders").select("currency_id").eq("id",poId).maybeSingle();const cid=currencyMap.get(importCell(r.currency_code).toUpperCase())||poRec?.currency_id,invId=inv?(invoiceMap.get(inv.toUpperCase())||(await supabase.from("invoices").select("id").eq("invoice_number",inv).maybeSingle()).data?.id):null;const ref=importCell(r.payment_reference);const payload:any={invoice_id:invId||null,purchase_order_id:poId,currency_id:cid,payment_date:importDate(r.payment_date)||new Date().toISOString().slice(0,10),paid_amount:Number(importCell(r.paid_amount).replace(/,/g,""))||0,payment_reference:ref||null,bank_reference:importCell(r.bank_reference)||null,is_historical:true,historical_source:importCell(r.historical_source)||source,historical_imported_at:now,historical_imported_by:user.id,created_by:user.id};let ex:any=null;if(ref)ex=(await supabase.from("payments").select("id").eq("payment_reference",ref).maybeSingle()).data;if(ex?.id)await supabase.from("payments").update({...payload,updated_at:now,updated_by:user.id}).eq("id",ex.id);else{const ins=await supabase.from("payments").insert(payload);if(ins.error)throw new Error(`Payment ${ref||po}: ${ins.error.message}`);stats.payments++}}
 revalidatePath("/dashboard");revalidatePath("/vendors");revalidatePath("/projects");revalidatePath("/purchase-orders");revalidatePath("/payment-milestones");revalidatePath("/invoices");revalidatePath("/payments");redirect(`/admin/historical-import?success=1&summary=${encodeURIComponent(JSON.stringify(stats))}`)
 } catch (e) {
   const message=e instanceof Error?e.message:"Historical import failed";
   redirect(`/admin/historical-import?error=${encodeURIComponent(message)}`);
 }
}

async function writeDeleteAudit(supabase:any,userId:string,entityType:string,entityId:string,label:string,reason:string){
  try{await supabase.from("audit_logs").insert({actor_user_id:userId,entity_type:entityType,entity_id:entityId,action:`DELETE_${entityType.toUpperCase()}`,after_data:{label,delete_reason:reason,delete_mode:"soft_delete"}});}catch{}
}

export async function deletePaymentMilestone(formData: FormData){
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"milestone_id"),reason=text(formData,"delete_reason")||"Deleted by Super Admin"; if(!id) redirect("/payment-milestones?error=Milestone%20ID%20is%20required");
  const {data:row}=await supabase.from("payment_milestones").select("milestone_name").eq("id",id).maybeSingle();
  const now=new Date().toISOString(); const {error}=await supabase.from("payment_milestones").update({is_deleted:true,deleted_at:now,deleted_by:user.id,delete_reason:reason,updated_at:now,updated_by:user.id}).eq("id",id); if(error) redirect(`/payment-milestones?error=${encodeURIComponent(error.message)}`);
  await writeDeleteAudit(supabase,user.id,"payment_milestone",id,row?.milestone_name||id,reason); revalidatePath("/payment-milestones");revalidatePath("/reports");revalidatePath("/dashboard");redirect("/payment-milestones?deleted=1");
}

export async function deletePayment(formData: FormData){
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"payment_id"),reason=text(formData,"delete_reason")||"Deleted by Super Admin"; if(!id) redirect("/payments?error=Payment%20ID%20is%20required");
  const {data:row}=await supabase.from("payments").select("payment_reference,paid_amount").eq("id",id).maybeSingle(); const now=new Date().toISOString();
  const {error}=await supabase.from("payments").update({is_deleted:true,deleted_at:now,deleted_by:user.id,delete_reason:reason,updated_at:now,updated_by:user.id}).eq("id",id); if(error) redirect(`/payments?error=${encodeURIComponent(error.message)}`);
  await writeDeleteAudit(supabase,user.id,"payment",id,row?.payment_reference||String(row?.paid_amount||id),reason); revalidatePath("/payments");revalidatePath("/reports");revalidatePath("/dashboard");redirect("/payments?deleted=1");
}

export async function deleteDocumentRecord(formData: FormData){
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"document_id"),reason=text(formData,"delete_reason")||"Deleted by Super Admin"; if(!id) redirect("/documents?error=Document%20ID%20is%20required");
  const {data:row}=await supabase.from("documents").select("document_title,file_name").eq("id",id).maybeSingle(); const now=new Date().toISOString();
  const {error}=await supabase.from("documents").update({is_deleted:true,deleted_at:now,deleted_by:user.id,delete_reason:reason}).eq("id",id); if(error) redirect(`/documents?error=${encodeURIComponent(error.message)}`);
  await writeDeleteAudit(supabase,user.id,"document",id,row?.document_title||row?.file_name||id,reason); revalidatePath("/documents");redirect("/documents?deleted=1");
}

// -----------------------------------------------------------------------------
// MCCS V2.12.1 - Excel-mirror VDRL + controlled Drive sync
// -----------------------------------------------------------------------------

const VDRL_FIELDS = [
  "document_number","document_title","discipline","sub_discipline","document_type","stage",
  "planned_submit_date","actual_submit_date","planned_return_date","actual_return_date",
  "ifc_planned_submit_date","ifc_actual_submit_date","revision","return_code",
  "status_override","resubmission_due_date","comments"
] as const;

type VdrlField = typeof VDRL_FIELDS[number];

const VDRL_ALIASES: Record<VdrlField,string[]> = {
  document_number:["document no","doc no","document number","vendor document number","document #","doc number","document code"],
  document_title:["document title","description","document description","title","document name"],
  discipline:["discipline","engineering discipline"],
  sub_discipline:["sub discipline","sub-discipline","subdiscipline"],
  document_type:["document type","doc type","type"],
  stage:["stage","document stage","issue purpose","purpose","status code"],
  planned_submit_date:["planned submit date","plan submit date","planned date","forecast date","submission date","target submission","planned submission","ifr planned submit","ifr planned submit date"],
  actual_submit_date:["actual submit date","actual submission date","vendor submission date","submitted date","actual issue date","ifr actual submit","ifr actual submit date"],
  planned_return_date:["planned return date","plan return date","return due date","review due date","miran return date","ifa planned return"],
  actual_return_date:["actual return date","returned date","miran actual return","actual review return","ifa actual return"],
  ifc_planned_submit_date:["ifc planned submit","ifc planned submit date","ifc plan submit","ifc submission date"],
  ifc_actual_submit_date:["ifc actual submit","ifc actual submit date","ifc actual submission"],
  revision:["revision","rev","version","current revision"],
  return_code:["return code","returned with code","review code","code","status code"],
  status_override:["status","document status","current status"],
  resubmission_due_date:["resubmission due date","resubmit due date","next submission due","re-submit due date","resubmission due"],
  comments:["comments","comment","remarks","remark","status comments"]
};

function vdrlNorm(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[_\-\/]+/g," ").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
}

function vdrlStatusKey(value: unknown) {
  const v = vdrlNorm(value);
  if (!v) return null;
  const map:Record<string,string> = {
    "pending submission":"pending_submission", "submitted under review":"under_miran_review",
    "under miran review":"under_miran_review", "returned for review":"returned_for_revision",
    "returned for revision":"returned_for_revision", "approved":"approved",
    "approved with comments":"approved", "overdue":"overdue_submission",
    "overdue submission":"overdue_submission", "overdue return":"overdue_return",
    "overdue resubmission":"overdue_resubmission", "on hold":"on_hold", "cancelled":"cancelled"
  };
  return map[v] || v.replace(/\s+/g,"_");
}

function vdrlCompositeHeaders(matrix:any[][], headerRow:number) {
  const row=(matrix[headerRow]||[]).map(vdrlCell);
  const gate=(matrix[Math.max(0,headerRow-1)]||[]).map(vdrlCell);
  let currentGate="";
  return row.map((h:string,i:number)=>{
    const g=String(gate[i]||"").trim().toUpperCase();
    if (["IFR","IFA","IFC","IFD","AS-BUILT","FINAL"].includes(g)) currentGate=g;
    if (!h) return `Column ${i+1}`;
    const n=vdrlNorm(h);
    if (currentGate && ["planned submit","planned submit date","actual submit","actual submit date","planned return","planned return date","actual return","actual return date"].includes(n)) return `${currentGate} ${h}`;
    return h;
  });
}

function vdrlDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  if (typeof value === "number" && value > 1000 && value < 100000) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
  }
  const s = String(value).trim();
  if (!s || s === "-" || s === "—") return null;
  // Time-only cells and Excel's 1900 placeholder dates are not VDRL dates.
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(s)) return null;
  if (/^1900[-\/.]/.test(s) || /1900$/.test(s)) return null;
  const iso = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;
  const dmy = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
}

function vdrlCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0,10);
  if (typeof value === "object") {
    const v:any = value;
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((x:any)=>x.text||"").join("");
  }
  return String(value).trim();
}

function detectVdrlMapping(headers: string[]) {
  const mapping: Record<string,string> = {};
  let scoreTotal = 0;
  for (const field of VDRL_FIELDS) {
    let best = { header:"", score:0 };
    for (const header of headers) {
      const hn = vdrlNorm(header);
      for (const alias of VDRL_ALIASES[field]) {
        const an = vdrlNorm(alias);
        let score = 0;
        if (hn === an) score = 1;
        else if (hn.includes(an) || an.includes(hn)) score = 0.82;
        if (score > best.score) best = { header, score };
      }
    }
    if (best.header && best.score >= 0.75) {
      // One physical Excel column may map to only one MCCS field. This prevents
      // title/stage/revision/date values from becoming mixed during updates.
      if (!Object.values(mapping).includes(best.header)) {
        mapping[field] = best.header;
        scoreTotal += field === "document_number" ? best.score * 2 : best.score;
      }
    }
  }
  const requiredWeight = mapping.document_number ? 2 : 0;
  const denom = 2 + (VDRL_FIELDS.length - 1);
  const confidence = Math.min(100, Math.round(((scoreTotal + requiredWeight) / denom) * 100));
  return { mapping, confidence };
}

function mappedVdrlRow(raw: Record<string,unknown>, mapping: Record<string,string>) {
  const out: Record<string,string|null> = {};
  for (const field of VDRL_FIELDS) {
    const header = mapping[field];
    const value = header ? raw[header] : null;
    if (field.includes("date")) out[field] = vdrlDate(value);
    else out[field] = vdrlCell(value) || null;
  }
  if (out.stage) out.stage = String(out.stage).toUpperCase().trim();
  if (out.return_code) out.return_code = String(out.return_code).toUpperCase().trim();
  if (out.status_override) out.status_override = vdrlStatusKey(out.status_override);
  if (out.revision) out.revision = String(out.revision).trim();
  if (out.document_number) out.document_number = String(out.document_number).trim();
  return out;
}

function vdrlComparable(x:any) {
  return {
    document_title:x?.document_title||null, discipline:x?.discipline||null, sub_discipline:x?.sub_discipline||null,
    document_type:x?.document_type||null, stage:x?.stage??x?.current_stage??null, revision:x?.revision??x?.current_revision??null,
    planned_submit_date:x?.planned_submit_date||null, actual_submit_date:x?.actual_submit_date||null,
    planned_return_date:x?.planned_return_date||null, actual_return_date:x?.actual_return_date||null,
    ifc_planned_submit_date:x?.ifc_planned_submit_date||null, ifc_actual_submit_date:x?.ifc_actual_submit_date||null,
    resubmission_due_date:x?.resubmission_due_date||null, return_code:x?.return_code||null,
    status_override:x?.status_override||null, comments:x?.comments||null
  };
}

function vdrlChanges(oldRow:any,newRow:any) {
  const a = vdrlComparable(oldRow), b = vdrlComparable(newRow), changes:any = {};
  for (const k of Object.keys(a)) if (String((a as any)[k]??"") !== String((b as any)[k]??"")) changes[k] = { old:(a as any)[k]??null, new:(b as any)[k]??null };
  return changes;
}

async function classifyVdrlRows(supabase:any, registerId:string, rows:Array<{row_no:number;raw_data:any;mapped_data:any;validation_errors:any[]}>) {
  const { data: existing } = await supabase.from("vdrl_documents").select("business_key,document_title,discipline,sub_discipline,document_type,current_stage,current_revision,planned_submit_date,actual_submit_date,planned_return_date,actual_return_date,ifc_planned_submit_date,ifc_actual_submit_date,resubmission_due_date,return_code,status_override,comments").eq("register_id",registerId).eq("is_active",true).limit(20000);
  const emap = new Map((existing??[]).map((x:any)=>[String(x.business_key||"").toUpperCase(),x]));
  return rows.map((r)=>{
    if (r.validation_errors.length) return {...r,classification:"invalid"};
    const key = String(r.mapped_data.document_number||"").trim().toUpperCase();
    const old = emap.get(key);
    if (!old) return {...r,classification:"new"};
    const changes = vdrlChanges(old,r.mapped_data);
    const classification = Object.keys(changes).length ? "changed" : "unchanged";
    return {...r,classification,mapped_data:{...r.mapped_data,_changes:changes}};
  });
}

async function getVdrlNames(supabase:any, supplierId:string, packageId:string|null, projectId:string|null) {
  const [{data:supplier},{data:pkg},{data:project}] = await Promise.all([
    supabase.from("vendors").select("vendor_name").eq("id",supplierId).maybeSingle(),
    packageId ? supabase.from("projects").select("project_name,project_code").eq("id",packageId).maybeSingle() : Promise.resolve({data:null}),
    projectId ? supabase.from("projects").select("project_name,project_code").eq("id",projectId).maybeSingle() : Promise.resolve({data:null}),
  ]);
  return { supplierName:supplier?.vendor_name||"Unknown Supplier", packageName:pkg?.project_name||pkg?.project_code||project?.project_name||project?.project_code||"General VDRL" };
}


async function fetchAllVdrlDocs(supabase:any, registerId:string) {
  const out:any[]=[];
  for(let from=0;;from+=1000){
    const {data,error}=await supabase.from("vdrl_documents").select("document_number,document_title,discipline,sub_discipline,document_type,current_stage,current_revision,planned_submit_date,actual_submit_date,planned_return_date,actual_return_date,ifc_planned_submit_date,ifc_actual_submit_date,resubmission_due_date,return_code,status_override,current_status,comments,submission_variance,return_variance,days_overdue,responsible_party,action_due_date").eq("register_id",registerId).eq("is_active",true).order("document_number").range(from,from+999);
    if(error)throw new Error(error.message); const rows=data??[]; out.push(...rows); if(rows.length<1000)break;
  }
  return out;
}

async function syncVdrlControlledOutput(supabase:any, registerId:string, userId:string) {
  const { data: register } = await supabase.from("vdrl_registers").select("*").eq("id",registerId).maybeSingle();
  if (!register) return;
  const [{supplierName,packageName},{data:docs}] = await Promise.all([
    getVdrlNames(supabase,String(register.supplier_id),register.package_id?String(register.package_id):null,register.project_id?String(register.project_id):null),
    fetchAllVdrlDocs(supabase,registerId).then(data=>({data}))
  ]);
  const contractorName = register.contractor_id ? ((await supabase.from("vendors").select("vendor_name").eq("id",register.contractor_id).maybeSingle()).data?.vendor_name || "") : "";
  const basePath=[supplierName,packageName,"Other Documents","VDRL"];
  const { data: job } = await supabase.from("vdrl_sync_jobs").insert({register_id:registerId,batch_id:register.current_batch_id,status:"processing",attempts:1,last_attempt_at:new Date().toISOString()}).select("id").single();
  try {
    await ensureGoogleFolderPath([...basePath,"Archive"]);
    const currentId = await ensureGoogleFolderPath([...basePath,"Current"]);
    if (register.current_controlled_file_id && register.current_controlled_folder_id !== currentId) await moveGoogleDriveFile(register.current_controlled_file_id,currentId,register.current_controlled_folder_id);
    const wb = new ExcelJS.Workbook(); wb.creator="MCCS"; wb.created=new Date();
    const ws = wb.addWorksheet("Controlled VDRL");
    ws.mergeCells("A1:T1"); ws.getCell("A1").value="MCCS – STANDARD VDRL IMPORT TEMPLATE";
    ws.mergeCells("A2:T2"); ws.getCell("A2").value="Controlled VDRL. Updates made in MCCS are synchronized automatically to this workbook.";
    ws.mergeCells("K3:L3"); ws.getCell("K3").value="IFR";
    ws.mergeCells("M3:N3"); ws.getCell("M3").value="IFA";
    ws.mergeCells("O3:P3"); ws.getCell("O3").value="IFC";
    const headers=["Document Number","Document Title","Supplier","Contractor","Package","Discipline","Sub-Discipline","Document Type","Stage","Status","Planned Submit","Actual Submit","Planned Return","Actual Return","Planned Submit","Actual Submit","Revision","Return Code","Resubmission Due","Remarks"];
    ws.getRow(4).values=headers;
    const widths=[28,42,18,18,26,20,20,20,12,16,16,16,16,16,16,12,14,22,18,38]; widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
    for (const d of (docs??[])) ws.addRow([
      d.document_number,d.document_title,supplierName,contractorName,packageName,d.discipline,d.sub_discipline,d.document_type,d.current_stage,niceVdrlStatus(d.current_status),
      d.planned_submit_date,d.actual_submit_date,d.planned_return_date,d.actual_return_date,d.ifc_planned_submit_date,d.ifc_actual_submit_date,
      d.current_revision,d.return_code,d.resubmission_due_date,d.comments
    ]);
    const navy="071C35", green="B7E46B";
    [1,4].forEach(r=>{ws.getRow(r).font={bold:true,color:{argb:"FFFFFFFF"}};ws.getRow(r).fill={type:"pattern",pattern:"solid",fgColor:{argb:`FF${navy}`}};});
    ws.getRow(1).alignment={horizontal:"center",vertical:"middle"}; ws.getRow(2).font={italic:true,color:{argb:"FF475569"}};
    [11,13,15].forEach(c=>{const cell=ws.getCell(3,c);cell.font={bold:true,color:{argb:"FF071C35"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:`FF${green}`}};cell.alignment={horizontal:"center"};});
    ws.getRow(3).height=20; ws.getRow(4).height=28; ws.views=[{state:"frozen",ySplit:4}]; ws.autoFilter={from:{row:4,column:1},to:{row:4,column:20}};
    for (let r=5;r<=ws.rowCount;r++) { [11,12,13,14,15,16,19].forEach(c=>ws.getCell(r,c).numFmt="dd-mmm-yyyy"); }
    const content = await wb.xlsx.writeBuffer();
    let controlledFileId=String(register.current_controlled_file_id||"");
    if(controlledFileId){
      await updateGoogleDriveFile(controlledFileId,content as ArrayBuffer,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } else {
      const uploaded = await uploadFileToGoogleDrive([...basePath,"Current"],`Controlled_VDRL_${sanitizeDriveName(packageName)}.xlsx`,content as ArrayBuffer,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      controlledFileId=uploaded.fileId;
    }
    await supabase.from("vdrl_registers").update({current_controlled_file_id:controlledFileId,current_controlled_folder_id:currentId,last_sync_at:new Date().toISOString(),last_successful_backup_at:new Date().toISOString(),updated_at:new Date().toISOString(),updated_by:userId}).eq("id",registerId);
    if (job?.id) await supabase.from("vdrl_sync_jobs").update({status:"success",google_drive_file_id:controlledFileId,updated_at:new Date().toISOString()}).eq("id",job.id);
  } catch(e:any) {
    if (job?.id) await supabase.from("vdrl_sync_jobs").update({status:"failed",last_error:e?.message||String(e),updated_at:new Date().toISOString()}).eq("id",job.id);
  }
}

function niceVdrlStatus(v:any){ return String(v||"").replaceAll("_"," ").replace(/\b\w/g,(m)=>m.toUpperCase()); }

export async function startVdrlImport(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const supplierId=text(formData,"supplier_id"), contractorId=nullable(formData,"contractor_id"), projectId=nullable(formData,"project_id"), packageId=nullable(formData,"package_id"), mode=text(formData,"upload_mode")||"new";
  const file=formData.get("vdrl_file");
  if (!supplierId || !(file instanceof File) || !file.size) redirect("/vdrl?panel=upload&error=Supplier%20and%20VDRL%20Excel%20file%20are%20required");
  if (!/\.(xlsx|xls)$/i.test(file.name)) redirect("/vdrl?panel=upload&error=Only%20XLS%20and%20XLSX%20files%20are%20supported");
  let successBatchId = "";
  try {
    const names=await getVdrlNames(supabase,supplierId,packageId,projectId);
    let regQ:any=supabase.from("vdrl_registers").select("*").eq("supplier_id",supplierId); regQ=packageId?regQ.eq("package_id",packageId):regQ.is("package_id",null); let {data:register}=await regQ.maybeSingle();
    if (!register) {
      const ins=await supabase.from("vdrl_registers").insert({register_name:`${names.supplierName} - ${names.packageName}`,supplier_id:supplierId,contractor_id:contractorId,project_id:projectId,package_id:packageId,created_by:user.id,updated_by:user.id}).select("*").single();
      if (ins.error) throw new Error(ins.error.message); register=ins.data;
    } else {
      await supabase.from("vdrl_registers").update({contractor_id:contractorId,project_id:projectId,updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",register.id);
    }
    const arrayBuffer=await file.arrayBuffer();
    const wb=XLSX.read(arrayBuffer,{type:"array",cellDates:true});
    let chosenSheet="", chosenHeader=0, matrix:any[][]=[], bestHits=-1;
    for (const sheetName of wb.SheetNames) {
      const rows:any[][]=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:"",raw:false,dateNF:"yyyy-mm-dd"}) as any[][];
      for (let i=0;i<Math.min(rows.length,25);i++) {
        const headers=vdrlCompositeHeaders(rows,i);
        const detected=detectVdrlMapping(headers);
        // Strongly prefer a genuine VDRL header row. A data row can contain words such as
        // "Document" or "Status" and must never outrank the real column headings.
        const normalizedHeaders=headers.map(vdrlNorm);
        const hasDocNo=normalizedHeaders.some((h:string)=>["document number","document no","doc no","doc number","vendor document number"].includes(h));
        const hasTitle=normalizedHeaders.some((h:string)=>["document title","document description","title","document name"].includes(h));
        const exactHeaderBonus=(hasDocNo?50:0)+(hasTitle?25:0);
        const hits=exactHeaderBonus+Object.keys(detected.mapping).length+(detected.mapping.document_number?5:0);
        if (hits>bestHits) {bestHits=hits;chosenSheet=sheetName;chosenHeader=i;matrix=rows;}
      }
    }
    if (!matrix.length) throw new Error("No readable worksheet data was found.");
    const headers=vdrlCompositeHeaders(matrix,chosenHeader);
    let {mapping,confidence}=detectVdrlMapping(headers);
    let templateQ:any=supabase.from("vdrl_mapping_templates").select("mapping").eq("supplier_id",supplierId).eq("is_active",true); templateQ=packageId?templateQ.eq("package_id",packageId):templateQ.is("package_id",null); const {data:template}=await templateQ.order("updated_at",{ascending:false}).limit(1).maybeSingle();
    if (template?.mapping && typeof template.mapping==="object") {
      // Reuse only mappings whose source header actually exists in THIS workbook.
      // This prevents a previous supplier/package template from shifting columns when
      // an updated VDRL has a different layout or header wording.
      const validTemplate:any={};
      for (const [field,header] of Object.entries(template.mapping as Record<string,string>)) {
        if (headers.includes(String(header))) validTemplate[field]=header;
      }
      mapping={...mapping,...validTemplate};
      if(Object.keys(validTemplate).length) confidence=Math.max(confidence,90);
    }
    const rawRows:any[]=[];
    for (let i=chosenHeader+1;i<matrix.length;i++) {
      const arr=matrix[i]||[]; if (!arr.some((v:any)=>vdrlCell(v)!=="")) continue;
      const raw:any={}; headers.forEach((h:string,j:number)=>{raw[h]=arr[j]??""});
      const mapped=mappedVdrlRow(raw,mapping); const errors:string[]=[];
      if (!mapped.document_number) errors.push("Document Number is required");
      rawRows.push({row_no:i+1,raw_data:raw,mapped_data:mapped,validation_errors:errors});
    }
    const classified=await classifyVdrlRows(supabase,String(register.id),rawRows);
    const counts={new:0,changed:0,unchanged:0,invalid:0}; classified.forEach((r:any)=>(counts as any)[r.classification]++);
    const incoming=new Set(classified.filter((r:any)=>r.classification!=="invalid").map((r:any)=>String(r.mapped_data.document_number||"").toUpperCase()));
    const {data:existingKeys}=await supabase.from("vdrl_documents").select("business_key").eq("register_id",register.id).eq("is_active",true).limit(20000);
    const missing=(existingKeys??[]).filter((x:any)=>!incoming.has(String(x.business_key||"").toUpperCase())).length;
    let drive:any={fileId:null,parentId:null,path:null}; let driveError:string|null=null;
    try { drive=await uploadFileToGoogleDrive([names.supplierName,names.packageName,"Other Documents","VDRL","Archive"],file.name,arrayBuffer,file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); } catch(e:any){driveError=e?.message||String(e);}
    const status=(!mapping.document_number||confidence<55)?"mapping_required":"preview";
    const {data:batch,error}=await supabase.from("vdrl_upload_batches").insert({register_id:register.id,supplier_id:supplierId,contractor_id:contractorId,project_id:projectId,package_id:packageId,upload_mode:mode,status,original_file_name:file.name,google_drive_file_id:drive.fileId,google_drive_folder_id:drive.parentId,google_drive_path:drive.path,headers,detected_mapping:mapping,mapping_confidence:confidence,worksheet_name:chosenSheet,header_row:chosenHeader+1,total_rows:classified.length,new_count:counts.new,changed_count:counts.changed,unchanged_count:counts.unchanged,missing_count:missing,invalid_count:counts.invalid,uploaded_by:user.id,error_message:driveError}).select("id").single();
    if (error||!batch) throw new Error(error?.message||"Could not create VDRL preview batch.");
    for (let i=0;i<classified.length;i+=500) { const chunk=classified.slice(i,i+500).map((r:any)=>({...r,batch_id:batch.id})); const rr=await supabase.from("vdrl_upload_rows").insert(chunk); if(rr.error) throw new Error(rr.error.message); }
    await supabase.from("vdrl_audit_history").insert({register_id:register.id,batch_id:batch.id,user_id:user.id,user_role:"super_admin",action:"VDRL Uploaded",supplier_id:supplierId,contractor_id:contractorId,project_id:projectId,package_id:packageId,new_value:{file:file.name,rows:classified.length,confidence},source:"Excel Upload",google_drive_file_id:drive.fileId});
    successBatchId=String(batch.id);
  } catch(e:any) { redirect(`/vdrl?panel=upload&error=${encodeURIComponent(e?.message||String(e))}`); }
  redirect(`/vdrl?batch=${successBatchId}`);
}

export async function remapVdrlBatch(formData:FormData) {
  const {supabase}=await requireSuperAdmin(); const batchId=text(formData,"batch_id"); if(!batchId)redirect("/vdrl?error=Missing%20batch");
  const {data:batch}=await supabase.from("vdrl_upload_batches").select("*").eq("id",batchId).maybeSingle(); if(!batch)redirect("/vdrl?error=Batch%20not%20found");
  const mapping:any={}; for(const field of VDRL_FIELDS){const v=text(formData,`map_${field}`);if(v)mapping[field]=v;}
  const {data:rows}=await supabase.from("vdrl_upload_rows").select("id,row_no,raw_data").eq("batch_id",batchId).order("row_no").limit(50000);
  const remapped=(rows??[]).map((r:any)=>{const mapped=mappedVdrlRow(r.raw_data,mapping);const errors:string[]=[];if(!mapped.document_number)errors.push("Document Number is required");return{row_no:r.row_no,raw_data:r.raw_data,mapped_data:mapped,validation_errors:errors};});
  const classified=await classifyVdrlRows(supabase,String(batch.register_id),remapped);
  for(const r of classified){await supabase.from("vdrl_upload_rows").update({mapped_data:r.mapped_data,validation_errors:r.validation_errors,classification:r.classification}).eq("batch_id",batchId).eq("row_no",r.row_no);}
  const c:any={new:0,changed:0,unchanged:0,invalid:0};classified.forEach((r:any)=>c[r.classification]++);
  await supabase.from("vdrl_upload_batches").update({detected_mapping:mapping,mapping_confidence:mapping.document_number?100:0,status:mapping.document_number?"preview":"mapping_required",new_count:c.new,changed_count:c.changed,unchanged_count:c.unchanged,invalid_count:c.invalid}).eq("id",batchId);
  redirect(`/vdrl?batch=${batchId}`);
}

export async function confirmVdrlImport(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin(); const batchId=text(formData,"batch_id"); if(!batchId)redirect("/vdrl?error=Missing%20batch");
  const {data:batch}=await supabase.from("vdrl_upload_batches").select("*").eq("id",batchId).maybeSingle(); if(!batch)redirect("/vdrl?error=Batch%20not%20found");
  let successRegisterId = "";
  try {
    const {error}=await supabase.rpc("vdrl_apply_batch",{p_batch:batchId}); if(error)throw new Error(error.message);
    const {error:extendedError}=await supabase.rpc("vdrl_apply_extended_batch",{p_batch:batchId}); if(extendedError)throw new Error(`VDRL extended fields: ${extendedError.message}`);
    const names=await getVdrlNames(supabase,String(batch.supplier_id),batch.package_id?String(batch.package_id):null,batch.project_id?String(batch.project_id):null);
    let currentFolderId:string|null=null;
    if(batch.google_drive_file_id){
      try {
        const {data:reg}=await supabase.from("vdrl_registers").select("current_original_file_id,current_original_folder_id").eq("id",batch.register_id).maybeSingle();
        const archiveId=await ensureGoogleFolderPath([names.supplierName,names.packageName,"Other Documents","VDRL","Archive"]); currentFolderId=await ensureGoogleFolderPath([names.supplierName,names.packageName,"Other Documents","VDRL","Current"]);
        if(reg?.current_original_file_id) await moveGoogleDriveFile(reg.current_original_file_id,archiveId,reg.current_original_folder_id);
        await moveGoogleDriveFile(batch.google_drive_file_id,currentFolderId,batch.google_drive_folder_id);
        await supabase.from("vdrl_registers").update({current_original_file_id:batch.google_drive_file_id,current_original_folder_id:currentFolderId,updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",batch.register_id);
      } catch(e:any){await supabase.from("vdrl_sync_jobs").insert({register_id:batch.register_id,batch_id:batch.id,status:"failed",attempts:1,last_attempt_at:new Date().toISOString(),last_error:e?.message||String(e),job_type:"archive_original"});}
    }
    if(batch.detected_mapping?.document_number){await supabase.from("vdrl_mapping_templates").upsert({supplier_id:batch.supplier_id,package_id:batch.package_id,template_name:"Latest confirmed mapping",mapping:batch.detected_mapping,header_signature:(batch.headers||[]).join("|"),is_active:true,updated_at:new Date().toISOString(),created_by:user.id},{onConflict:"supplier_id,package_id,template_name"});}
    await syncVdrlControlledOutput(supabase,String(batch.register_id),user.id);
    successRegisterId=String(batch.register_id); revalidatePath("/vdrl");
  } catch(e:any){redirect(`/vdrl?batch=${batchId}&error=${encodeURIComponent(e?.message||String(e))}`);}
  redirect(`/vdrl?confirmed=1&register=${successRegisterId}`);
}


export async function deleteVdrlUpload(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin();
  const batchId=text(formData,"batch_id");
  if(!batchId) redirect("/vdrl?error=Missing%20VDRL%20upload");
  const {data:batch}=await supabase.from("vdrl_upload_batches").select("id,register_id,google_drive_file_id,status").eq("id",batchId).maybeSingle();
  if(!batch) redirect("/vdrl?error=VDRL%20upload%20not%20found");
  const {data:result,error}=await supabase.rpc("vdrl_delete_upload",{p_batch:batchId});
  if(error) redirect(`/vdrl?error=${encodeURIComponent(error.message)}`);
  const fileId=String((result as any)?.google_drive_file_id||batch.google_drive_file_id||"");
  if(fileId){
    try{await deleteGoogleDriveFile(fileId);}catch(e){console.error("VDRL Drive cleanup failed",e);}
  }
  if(batch.register_id){
    try{await syncVdrlControlledOutput(supabase,String(batch.register_id),user.id);}catch(e){console.error("VDRL controlled output refresh failed",e);}
  }
  revalidatePath("/vdrl");
  redirect("/vdrl?deleted=1");
}

export async function updateVdrlDocument(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"document_id"); if(!id)redirect("/vdrl?error=Missing%20document");
  const {data:old}=await supabase.from("vdrl_documents").select("*").eq("id",id).maybeSingle(); if(!old)redirect("/vdrl?error=Document%20not%20found");
  const patch:any={document_title:nullable(formData,"document_title"),discipline:nullable(formData,"discipline"),sub_discipline:nullable(formData,"sub_discipline"),document_type:nullable(formData,"document_type"),current_stage:nullable(formData,"stage"),current_revision:nullable(formData,"revision"),planned_submit_date:nullable(formData,"planned_submit_date"),actual_submit_date:nullable(formData,"actual_submit_date"),planned_return_date:nullable(formData,"planned_return_date"),actual_return_date:nullable(formData,"actual_return_date"),ifc_planned_submit_date:nullable(formData,"ifc_planned_submit_date"),ifc_actual_submit_date:nullable(formData,"ifc_actual_submit_date"),resubmission_due_date:nullable(formData,"resubmission_due_date"),return_code:nullable(formData,"return_code"),status_override:nullable(formData,"status_override"),comments:nullable(formData,"comments"),updated_at:new Date().toISOString(),updated_by:user.id};
  const {error}=await supabase.from("vdrl_documents").update(patch).eq("id",id); if(error)redirect(`/vdrl?edit=${id}&error=${encodeURIComponent(error.message)}`);
  await supabase.from("vdrl_revisions").insert({document_id:id,stage:old.current_stage,revision:old.current_revision,planned_submit_date:old.planned_submit_date,actual_submit_date:old.actual_submit_date,planned_return_date:old.planned_return_date,actual_return_date:old.actual_return_date,resubmission_due_date:old.resubmission_due_date,return_code:old.return_code,status:old.current_status,responsible_party:old.responsible_party,source_batch_id:old.source_batch_id,source_file_id:old.source_file_id,snapshot:old,created_by:user.id});
  await supabase.from("vdrl_audit_history").insert({register_id:old.register_id,document_id:id,batch_id:old.source_batch_id,user_id:user.id,user_role:"super_admin",action:"Manual Correction",supplier_id:old.supplier_id,contractor_id:old.contractor_id,project_id:old.project_id,package_id:old.package_id,document_number:old.document_number,revision:patch.current_revision,stage:patch.current_stage,old_value:old,new_value:patch,source:"MCCS Manual Edit",google_drive_file_id:old.source_file_id});
  await supabase.rpc("vdrl_refresh_statuses"); await syncVdrlControlledOutput(supabase,String(old.register_id),user.id); revalidatePath("/vdrl"); redirect(`/vdrl?detail=${id}&updated=1`);
}


export async function updateVdrlInline(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"document_id"); if(!id)redirect("/vdrl?error=Missing%20document");
  const {data:old}=await supabase.from("vdrl_documents").select("*").eq("id",id).maybeSingle(); if(!old)redirect("/vdrl?error=Document%20not%20found");
  const patch:any={
    current_stage:nullable(formData,"stage"),
    actual_submit_date:nullable(formData,"actual_submit_date"), actual_return_date:nullable(formData,"actual_return_date"),
    ifc_planned_submit_date:nullable(formData,"ifc_planned_submit_date"), ifc_actual_submit_date:nullable(formData,"ifc_actual_submit_date"),
    current_revision:nullable(formData,"revision"), return_code:nullable(formData,"return_code"),
    status_override:nullable(formData,"status_override"), resubmission_due_date:nullable(formData,"resubmission_due_date"),
    comments:nullable(formData,"comments"), updated_at:new Date().toISOString(), updated_by:user.id
  };
  const {error}=await supabase.from("vdrl_documents").update(patch).eq("id",id); if(error)redirect(`/vdrl?error=${encodeURIComponent(error.message)}`);
  await supabase.from("vdrl_revisions").insert({document_id:id,stage:old.current_stage,revision:old.current_revision,planned_submit_date:old.planned_submit_date,actual_submit_date:old.actual_submit_date,planned_return_date:old.planned_return_date,actual_return_date:old.actual_return_date,resubmission_due_date:old.resubmission_due_date,return_code:old.return_code,status:old.current_status,responsible_party:old.responsible_party,source_batch_id:old.source_batch_id,source_file_id:old.source_file_id,snapshot:old,created_by:user.id});
  await supabase.from("vdrl_audit_history").insert({register_id:old.register_id,document_id:id,batch_id:old.source_batch_id,user_id:user.id,user_role:"super_admin",action:"Inline VDRL Edit",supplier_id:old.supplier_id,contractor_id:old.contractor_id,project_id:old.project_id,package_id:old.package_id,document_number:old.document_number,revision:patch.current_revision,stage:patch.current_stage,old_value:old,new_value:patch,source:"MCCS VDRL Register"});
  await supabase.rpc("vdrl_refresh_statuses"); await syncVdrlControlledOutput(supabase,String(old.register_id),user.id); revalidatePath("/vdrl"); redirect("/vdrl?updated=1");
}

export async function saveVdrlSettings(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin(); const days=Math.max(1,Math.min(60,Number(text(formData,"review_cycle_days")||5))); const override=nullable(formData,"data_date_override"); const auto=formData.get("auto_sync")==="on";
  const {error}=await supabase.from("vdrl_settings").upsert({id:1,review_cycle_days:days,data_date_override:override,auto_sync:auto,updated_at:new Date().toISOString(),updated_by:user.id}); if(error)redirect(`/vdrl?tab=settings&error=${encodeURIComponent(error.message)}`); await supabase.rpc("vdrl_refresh_statuses"); revalidatePath("/vdrl"); redirect("/vdrl?tab=settings&saved=1");
}

export async function saveVdrlStage(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin(); const id=nullable(formData,"stage_id"),code=text(formData,"code").toUpperCase(),name=text(formData,"name"); if(!code||!name)redirect("/vdrl?tab=settings&error=Stage%20code%20and%20name%20are%20required"); const payload:any={code,name,color:text(formData,"color")||"blue",sequence_no:Number(text(formData,"sequence_no")||100),is_active:formData.get("is_active")==="on",updated_at:new Date().toISOString(),updated_by:user.id}; const r=id?await supabase.from("vdrl_stages").update(payload).eq("id",id):await supabase.from("vdrl_stages").insert({...payload,created_by:user.id}); if(r.error)redirect(`/vdrl?tab=settings&error=${encodeURIComponent(r.error.message)}`); revalidatePath("/vdrl"); redirect("/vdrl?tab=settings");
}

export async function saveVdrlReturnCode(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin(); const id=nullable(formData,"return_code_id"),code=text(formData,"code").toUpperCase(),description=text(formData,"description"); if(!code||!description)redirect("/vdrl?tab=settings&error=Return%20code%20and%20description%20are%20required"); const payload:any={code,description,approved:formData.get("approved")==="on",resubmission_required:formData.get("resubmission_required")==="on",close_document:formData.get("close_document")==="on",next_stage:nullable(formData,"next_stage"),color:text(formData,"color")||"slate",is_active:formData.get("is_active")==="on",updated_at:new Date().toISOString(),updated_by:user.id}; const r=id?await supabase.from("vdrl_return_codes").update(payload).eq("id",id):await supabase.from("vdrl_return_codes").insert({...payload,created_by:user.id}); if(r.error)redirect(`/vdrl?tab=settings&error=${encodeURIComponent(r.error.message)}`); await supabase.rpc("vdrl_refresh_statuses"); revalidatePath("/vdrl"); redirect("/vdrl?tab=settings");
}

export async function retryVdrlSync(formData:FormData) {
  const {supabase,user}=await requireSuperAdmin(); const registerId=text(formData,"register_id"); if(registerId)await syncVdrlControlledOutput(supabase,registerId,user.id); revalidatePath("/vdrl"); redirect("/vdrl?sync=1");
}


// MCCS V2.13.1 secure collaboration actions ----------------------------------------------
export async function getWebRtcIceServers() {
  const access = await currentAccess();
  if (access.profile?.is_active === false) throw new Error("Your MCCS account is suspended.");
  const stunUrls = (process.env.WEBRTC_STUN_URLS || "stun:stun.l.google.com:19302").split(",").map((x)=>x.trim()).filter(Boolean);
  const iceServers:any[] = stunUrls.length ? [{ urls: stunUrls }] : [];
  const turnUrls = (process.env.WEBRTC_TURN_URLS || "").split(",").map((x)=>x.trim()).filter(Boolean);
  if (turnUrls.length) {
    const username = process.env.WEBRTC_TURN_USERNAME || "";
    const credential = process.env.WEBRTC_TURN_CREDENTIAL || "";
    if (!username || !credential) throw new Error("TURN URLs are configured but TURN credentials are missing.");
    iceServers.push({ urls: turnUrls, username, credential });
  }
  return iceServers;
}

export async function uploadChatVoice(formData: FormData) {
  const access = await currentAccess();
  if (access.profile?.is_active === false) throw new Error("Your MCCS account is suspended.");
  const recipientId = text(formData, "recipient_id");
  const groupId = text(formData, "group_id");
  const durationSeconds = Math.max(0, Number(text(formData, "duration_seconds") || "0"));
  const waveformRaw = text(formData, "waveform");
  const file = formData.get("voice") as File | null;
  if ((!recipientId && !groupId) || (recipientId && groupId)) throw new Error("Choose either one chat recipient or one group.");
  if (recipientId && recipientId === access.user.id) throw new Error("A valid chat recipient is required.");
  if (groupId) {
    const { data: membership, error: memberError } = await access.supabase
      .from("chat_group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", access.user.id)
      .maybeSingle();
    if (memberError || !membership) throw new Error("You are not authorised to send messages to this group.");
  }
  if (!(file instanceof File) || file.size <= 0) throw new Error("No voice recording was supplied.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Voice message is too large. Maximum size is 15 MB.");
  let waveform: number[] = [];
  try { waveform = JSON.parse(waveformRaw || "[]").slice(0, 120).map((x:any)=>Math.max(0,Math.min(1,Number(x)||0))); } catch { waveform = []; }

  const title = `Voice message ${new Date().toISOString().replace(/[:.]/g,"-")}`;
  const doc = await saveCommercialFile({
    supabase: access.supabase,
    userId: access.user.id,
    file,
    folderParts: ["Chat", "Voice Messages", String(new Date().getUTCFullYear()), new Date().toLocaleString("en", { month: "long", timeZone: "UTC" })],
    documentTitle: title,
    documentType: "Voice Message",
    documentCategory: "chat_voice",
  });
  if (!doc?.id) throw new Error("The voice recording could not be stored.");

  const payload:any = {
    sender_id: access.user.id,
    recipient_id: recipientId || null,
    group_id: groupId || null,
    body: "",
    attachment_document_id: doc.id,
    message_type: "voice",
    voice_duration_seconds: durationSeconds,
    voice_waveform: waveform,
  };
  const { data: message, error } = await access.supabase.from("chat_messages").insert(payload)
    .select("id,sender_id,recipient_id,group_id,body,created_at,read_at,attachment_document_id,message_type,voice_duration_seconds,voice_waveform").single();
  if (error || !message) throw new Error(error?.message || "Voice message could not be saved.");
  return message;
}
