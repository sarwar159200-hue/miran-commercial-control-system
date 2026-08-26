import { NextResponse } from "next/server";
import { requireUser } from "@/lib/mccs/auth";
import { folderPartsForCommercialDocument, sanitizeDriveName, startResumableGoogleDriveUpload } from "@/lib/google/drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireUser();
    const body = await request.json();
    const projectId = String(body.project_id || "");
    const vendorId = String(body.vendor_id || "");
    const purchaseOrderId = String(body.purchase_order_id || "");
    const invoiceId = String(body.invoice_id || "");
    const category = String(body.document_category || "other_document").toLowerCase();
    const fileName = String(body.file_name || "");
    const fileSize = Number(body.file_size || 0);
    const mimeType = String(body.mime_type || "application/octet-stream");
    const documentTitle = String(body.document_title || "").trim();
    const revision = String(body.revision || "").trim();

    if (!projectId || !vendorId || !fileName || !fileSize) return NextResponse.json({ error: "Vendor, project and file details are required." }, { status: 400 });
    if (category === "po" && !purchaseOrderId) return NextResponse.json({ error: "Select the Purchase Order for a PO document." }, { status: 400 });
    if (category === "invoice" && !invoiceId) return NextResponse.json({ error: "Select the Invoice for an invoice document." }, { status: 400 });

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
      category,
      poNumber: po?.po_number,
      invoiceNumber: invoice?.invoice_number,
    });

    const baseTitle = documentTitle || fileName.replace(/\.[^.]+$/, "");
    const extension = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
    const uploadName = `${sanitizeDriveName(baseTitle)}${revision ? ` - ${sanitizeDriveName(revision)}` : ""}${extension}`;
    const session = await startResumableGoogleDriveUpload(folderParts, uploadName, mimeType, fileSize);
    return NextResponse.json({ ok: true, ...session, uploadName, title: baseTitle, invoicePurchaseOrderId: invoice?.purchase_order_id || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start upload." }, { status: 500 });
  }
}
