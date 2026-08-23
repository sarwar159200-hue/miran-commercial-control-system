import { NextResponse } from "next/server";
import { requireUser } from "@/lib/mccs/auth";
import { uploadFileToGoogleDrive, sanitizeDriveName } from "@/lib/google/drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "A valid file is required." }, { status: 400 });

    const projectId = String(form.get("project_id") || "");
    const purchaseOrderId = String(form.get("purchase_order_id") || "");
    const invoiceId = String(form.get("invoice_id") || "");
    const vendorId = String(form.get("vendor_id") || "");
    const milestoneId = String(form.get("milestone_id") || "");
    const documentTitle = String(form.get("document_title") || "").trim();
    const documentType = String(form.get("document_type") || "Supporting Document").trim();
    const revision = String(form.get("revision") || "").trim();
    const isHistorical = String(form.get("is_historical") || "") === "true";

    if (!documentTitle) return NextResponse.json({ error: "Document title is required." }, { status: 400 });
    if (!purchaseOrderId && !invoiceId) return NextResponse.json({ error: "Assign the document to at least one Purchase Order or Invoice." }, { status: 400 });

    const [projectResult, poResult, invoiceResult, vendorResult] = await Promise.all([
      projectId ? supabase.from("projects").select("project_code,project_name").eq("id", projectId).maybeSingle() : Promise.resolve({ data: null } as any),
      purchaseOrderId ? supabase.from("purchase_orders").select("po_number,project_id,vendor_id").eq("id", purchaseOrderId).maybeSingle() : Promise.resolve({ data: null } as any),
      invoiceId ? supabase.from("invoices").select("invoice_number,purchase_order_id,vendor_id").eq("id", invoiceId).maybeSingle() : Promise.resolve({ data: null } as any),
      vendorId ? supabase.from("vendors").select("vendor_name").eq("id", vendorId).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);

    let effectivePoId = purchaseOrderId || invoiceResult.data?.purchase_order_id || "";
    let effectiveVendorId = vendorId || invoiceResult.data?.vendor_id || poResult.data?.vendor_id || "";
    let poData: any = poResult.data;
    if (!poData && effectivePoId) poData = (await supabase.from("purchase_orders").select("po_number,project_id,vendor_id").eq("id", effectivePoId).maybeSingle()).data;
    let vendorData: any = vendorResult.data;
    if (!vendorData && effectiveVendorId) vendorData = (await supabase.from("vendors").select("vendor_name").eq("id", effectiveVendorId).maybeSingle()).data;

    let projectData: any = projectResult.data;
    const effectiveProjectId = projectId || poData?.project_id || "";
    if (!projectData && effectiveProjectId) projectData = (await supabase.from("projects").select("project_code,project_name").eq("id", effectiveProjectId).maybeSingle()).data;

    const projectLabel = projectData?.project_code || projectData?.project_name || "Unassigned Project";
    const contractorLabel = vendorData?.vendor_name || "Unassigned Contractor";
    const poLabel = poData?.po_number || "Unassigned PO";
    const invoiceLabel = invoiceResult.data?.invoice_number || "";

    const folderParts = isHistorical
      ? ["Historical", projectLabel, contractorLabel, invoiceLabel ? "Invoices" : "Purchase Orders", invoiceLabel || poLabel]
      : ["Projects", projectLabel, "Contractors", contractorLabel, invoiceLabel ? "Invoices" : "Purchase Orders", invoiceLabel || poLabel];

    const uploadName = `${sanitizeDriveName(documentTitle)}${revision ? ` - ${sanitizeDriveName(revision)}` : ""}${file.name.includes(".") ? `.${file.name.split(".").pop()}` : ""}`;
    const uploaded = await uploadFileToGoogleDrive(folderParts, uploadName, await file.arrayBuffer(), file.type || "application/octet-stream");

    const { data: document, error } = await supabase.from("documents").insert({
      project_id: effectiveProjectId || null,
      vendor_id: effectiveVendorId || null,
      purchase_order_id: effectivePoId || null,
      invoice_id: invoiceId || null,
      milestone_id: milestoneId || null,
      document_title: documentTitle,
      document_type: documentType,
      file_name: uploaded.name,
      revision: revision || null,
      is_historical: isHistorical,
      uploaded_by: user.id,
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

    if (error) return NextResponse.json({ error: `File uploaded to Google Drive, but MCCS metadata save failed: ${error.message}`, uploaded }, { status: 500 });
    return NextResponse.json({ ok: true, documentId: document.id, uploaded });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
