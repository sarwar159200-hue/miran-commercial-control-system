import { NextResponse } from "next/server";
import { requireUser } from "@/lib/mccs/auth";
import { uploadFileToGoogleDrive, sanitizeDriveName, folderPartsForCommercialDocument } from "@/lib/google/drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const form = await request.formData();
    const files = [...form.getAll("files"), ...form.getAll("file")].filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return NextResponse.json({ error: "At least one file is required." }, { status: 400 });

    const projectId = String(form.get("project_id") || "");
    const purchaseOrderId = String(form.get("purchase_order_id") || "");
    const invoiceId = String(form.get("invoice_id") || "");
    const vendorId = String(form.get("vendor_id") || "");
    const milestoneId = String(form.get("milestone_id") || "");
    const documentTitle = String(form.get("document_title") || "").trim();
    const documentType = String(form.get("document_type") || "Supporting Document").trim();
    const documentCategory = String(form.get("document_category") || "other_document").trim().toLowerCase();
    const revision = String(form.get("revision") || "").trim();
    const isHistorical = String(form.get("is_historical") || "") === "true";

    if (!projectId || !vendorId) return NextResponse.json({ error: "Vendor / Contractor and Project / Package are required." }, { status: 400 });
    if (documentCategory === "po" && !purchaseOrderId) return NextResponse.json({ error: "Select the Purchase Order for a PO document." }, { status: 400 });
    if (documentCategory === "invoice" && !invoiceId) return NextResponse.json({ error: "Select the Invoice for an invoice document." }, { status: 400 });

    const [projectResult, vendorResult, poResult, invoiceResult] = await Promise.all([
      supabase.from("projects").select("project_name,vendor_id").eq("id", projectId).maybeSingle(),
      supabase.from("vendors").select("vendor_name").eq("id", vendorId).maybeSingle(),
      purchaseOrderId ? supabase.from("purchase_orders").select("po_number,project_id,vendor_id").eq("id", purchaseOrderId).maybeSingle() : Promise.resolve({ data: null } as any),
      invoiceId ? supabase.from("invoices").select("invoice_number,purchase_order_id,vendor_id").eq("id", invoiceId).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);

    const project = projectResult.data as any;
    const vendor = vendorResult.data as any;
    const po = poResult.data as any;
    const invoice = invoiceResult.data as any;
    if (!project?.project_name || !vendor?.vendor_name) return NextResponse.json({ error: "Vendor or project could not be resolved." }, { status: 400 });
    if (project.vendor_id && String(project.vendor_id) !== vendorId) return NextResponse.json({ error: "Selected project does not belong to the selected vendor." }, { status: 400 });

    const folderParts = await folderPartsForCommercialDocument({
      vendorName: vendor.vendor_name,
      projectName: project.project_name,
      category: documentCategory,
      poNumber: po?.po_number,
      invoiceNumber: invoice?.invoice_number,
    });

    const uploadedDocs = [];
    for (const file of files) {
      const baseTitle = documentTitle || file.name.replace(/\.[^.]+$/, "");
      const title = files.length > 1 && documentTitle ? `${documentTitle} - ${file.name.replace(/\.[^.]+$/, "")}` : baseTitle;
      const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
      const uploadName = `${sanitizeDriveName(title)}${revision ? ` - ${sanitizeDriveName(revision)}` : ""}${extension}`;
      const uploaded = await uploadFileToGoogleDrive(folderParts, uploadName, await file.arrayBuffer(), file.type || "application/octet-stream");
      const { data: document, error } = await supabase.from("documents").insert({
        project_id: projectId,
        vendor_id: vendorId,
        purchase_order_id: purchaseOrderId || invoice?.purchase_order_id || null,
        invoice_id: invoiceId || null,
        milestone_id: milestoneId || null,
        document_title: title,
        document_type: documentType,
        document_category: documentCategory,
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
      uploadedDocs.push({ documentId: document.id, uploaded });
    }

    return NextResponse.json({ ok: true, count: uploadedDocs.length, documents: uploadedDocs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
