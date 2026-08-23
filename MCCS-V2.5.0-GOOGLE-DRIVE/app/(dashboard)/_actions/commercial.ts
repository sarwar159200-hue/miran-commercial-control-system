"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/mccs/auth";
import { currentAccess, requireReviewAuthority } from "@/lib/mccs/invoice-auth";

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
  const historical = formData.get("is_historical") === "on";
  const reviewerId = nullable(formData,"assigned_reviewer_id");
  const invoiceNumber = text(formData,"invoice_number");
  const now = new Date().toISOString();
  const { data: created, error } = await supabase.from("invoices").insert({
    purchase_order_id: text(formData,"purchase_order_id"),
    vendor_id: text(formData,"vendor_id"),
    payment_milestone_id: nullable(formData,"milestone_id"),
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
  revalidatePath("/invoices"); revalidatePath("/invoices/reviews"); revalidatePath("/dashboard"); redirect(`/invoices/${created.id}?created=1`);
}

export async function updateInvoice(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const id=text(formData,"invoice_id"); const historical=formData.get("is_historical")==="on";
  const { error }=await supabase.from("invoices").update({
    purchase_order_id:text(formData,"purchase_order_id"), vendor_id:text(formData,"vendor_id"), payment_milestone_id:nullable(formData,"milestone_id"),
    invoice_number:text(formData,"invoice_number"), invoice_date:text(formData,"invoice_date"), received_date:nullable(formData,"received_date"),
    currency_id:text(formData,"currency_id"), invoice_amount:num(formData,"invoice_amount"), certified_amount:num(formData,"certified_amount"),
    status:text(formData,"status")||"received", due_date:nullable(formData,"due_date"), verification_notes:nullable(formData,"verification_notes"),
    is_historical:historical, historical_source:nullable(formData,"historical_source"), updated_at:new Date().toISOString(), updated_by:user.id
  }).eq("id",id);
  if(error) redirect(`/invoices/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/invoices"); revalidatePath("/dashboard"); redirect("/invoices?updated=1");
}

export async function createPayment(formData: FormData) {
  const { supabase, user }=await requireSuperAdmin(); const historical=formData.get("is_historical")==="on";
  const { error }=await supabase.from("payments").insert({invoice_id:nullable(formData,"invoice_id"),purchase_order_id:text(formData,"purchase_order_id"),currency_id:text(formData,"currency_id"),payment_date:text(formData,"payment_date"),paid_amount:num(formData,"paid_amount"),payment_reference:nullable(formData,"payment_reference"),bank_reference:nullable(formData,"bank_reference"),notes:nullable(formData,"notes"),is_historical:historical,historical_source:nullable(formData,"historical_source"),historical_imported_at:historical?new Date().toISOString():null,historical_imported_by:historical?user.id:null,created_by:user.id});
  if(error) redirect(`/payments/new?error=${encodeURIComponent(error.message)}`); revalidatePath("/payments"); revalidatePath("/dashboard"); redirect("/payments?created=1");
}

export async function updatePayment(formData: FormData) {
 const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"payment_id"); const historical=formData.get("is_historical")==="on";
 const {error}=await supabase.from("payments").update({invoice_id:nullable(formData,"invoice_id"),purchase_order_id:text(formData,"purchase_order_id"),currency_id:text(formData,"currency_id"),payment_date:text(formData,"payment_date"),paid_amount:num(formData,"paid_amount"),payment_reference:nullable(formData,"payment_reference"),bank_reference:nullable(formData,"bank_reference"),notes:nullable(formData,"notes"),is_historical:historical,historical_source:nullable(formData,"historical_source"),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/payments/${id}/edit?error=${encodeURIComponent(error.message)}`); revalidatePath("/payments"); revalidatePath("/dashboard"); redirect("/payments?updated=1");
}

export async function updateMilestone(formData: FormData) {
 const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"milestone_id"); const poId=text(formData,"purchase_order_id"); const pctRaw=text(formData,"percentage"); const fixedRaw=text(formData,"fixed_amount");
 const {data:po}=await supabase.from("purchase_orders").select("current_value").eq("id",poId).maybeSingle();
 const pct=pctRaw?Number(pctRaw):null; const fixed=pct!=null?Number(po?.current_value||0)*pct/100:(fixedRaw?Number(fixedRaw.replace(/,/g,"")):null);
 const {error}=await supabase.from("payment_milestones").update({milestone_name:text(formData,"milestone_name"),percentage:pct,fixed_amount:fixed,planned_due_date:nullable(formData,"planned_due_date"),payment_due_date:nullable(formData,"payment_due_date"),status:text(formData,"status")||"planned",is_historical:formData.get("is_historical")==="on",notes:nullable(formData,"notes"),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/payment-milestones/${id}/edit?error=${encodeURIComponent(error.message)}`); revalidatePath("/payment-milestones");revalidatePath(`/purchase-orders/${poId}`);revalidatePath("/dashboard");redirect("/payment-milestones?updated=1");
}

export async function updatePurchaseOrderDetails(formData: FormData){
 const {supabase,user}=await requireSuperAdmin(); const id=text(formData,"po_id");
 const {error}=await supabase.from("purchase_orders").update({project_id:nullable(formData,"project_id"),vendor_id:text(formData,"vendor_id"),parent_contractor_id:nullable(formData,"parent_contractor_id"),po_number:text(formData,"po_number"),pr_number:nullable(formData,"pr_number"),rfq_number:nullable(formData,"rfq_number"),po_date:text(formData,"po_date"),approval_date:nullable(formData,"approval_date"),approved_by_text:nullable(formData,"approved_by_text"),currency_id:text(formData,"currency_id"),original_value:num(formData,"original_value"),payment_terms:nullable(formData,"payment_terms"),delivery_terms:nullable(formData,"delivery_terms"),delivery_due_date:nullable(formData,"delivery_due_date"),status:text(formData,"status")||"active",is_historical:formData.get("is_historical")==="on",historical_source:nullable(formData,"historical_source"),notes:nullable(formData,"notes"),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/purchase-orders/${id}/edit?error=${encodeURIComponent(error.message)}`);revalidatePath("/purchase-orders");revalidatePath(`/purchase-orders/${id}`);revalidatePath("/dashboard");redirect(`/purchase-orders/${id}?updated=1`);
}

export async function updateVendor(formData: FormData){
 const {supabase,user}=await requireSuperAdmin();const id=text(formData,"vendor_id");
 const {error}=await supabase.from("vendors").update({vendor_code:nullable(formData,"vendor_code"),vendor_name:text(formData,"vendor_name"),legal_name:nullable(formData,"legal_name"),relationship_type:text(formData,"relationship_type")||"direct_contractor",parent_vendor_id:nullable(formData,"parent_vendor_id"),country:nullable(formData,"country"),address:nullable(formData,"address"),contact_person:nullable(formData,"contact_person"),email:nullable(formData,"email"),phone:nullable(formData,"phone"),tax_number:nullable(formData,"tax_number"),default_currency_id:nullable(formData,"default_currency_id"),is_active:formData.get("is_active")==="on",notes:nullable(formData,"notes"),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/vendors/${id}/edit?error=${encodeURIComponent(error.message)}`);revalidatePath("/vendors");redirect("/vendors?updated=1");
}

export async function updateProject(formData: FormData){
 const {supabase,user}=await requireSuperAdmin();const id=text(formData,"project_id");
 const {error}=await supabase.from("projects").update({project_code:text(formData,"project_code"),project_name:text(formData,"project_name"),description:nullable(formData,"description"),start_date:nullable(formData,"start_date"),planned_finish_date:nullable(formData,"planned_finish_date"),is_active:formData.get("is_active")==="on",updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error) redirect(`/admin/projects/${id}/edit?error=${encodeURIComponent(error.message)}`);revalidatePath("/admin/projects");revalidatePath("/purchase-orders/new");redirect("/admin/projects?updated=1");
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
