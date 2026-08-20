import { NextResponse } from "next/server";
import { requireUser } from "@/lib/mccs/auth";
import {
  sanitizePathPart,
  uploadFileToMicrosoftStorage,
} from "@/lib/microsoft/onedrive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const form = await request.formData();

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }

    const projectId = String(form.get("project_id") || "");
    const purchaseOrderId = String(form.get("purchase_order_id") || "");
    const vendorId = String(form.get("vendor_id") || "");
    const milestoneId = String(form.get("milestone_id") || "");
    const documentType = String(form.get("document_type") || "Document").trim();
    const revision = String(form.get("revision") || "").trim();
    const isHistorical = String(form.get("is_historical") || "") === "true";

    const [projectResult, poResult, vendorResult] = await Promise.all([
      projectId
        ? supabase.from("projects").select("project_code,project_name").eq("id", projectId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      purchaseOrderId
        ? supabase.from("purchase_orders").select("po_number,project_id").eq("id", purchaseOrderId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      vendorId
        ? supabase.from("vendors").select("vendor_name").eq("id", vendorId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    let projectLabel =
      projectResult.data?.project_code ||
      projectResult.data?.project_name ||
      "Unassigned Project";

    if (!projectId && poResult.data?.project_id) {
      const inherited = await supabase
        .from("projects")
        .select("project_code,project_name")
        .eq("id", poResult.data.project_id)
        .maybeSingle();

      projectLabel =
        inherited.data?.project_code ||
        inherited.data?.project_name ||
        projectLabel;
    }

    const vendorLabel = vendorResult.data?.vendor_name || "Unassigned Vendor";
    const poLabel = poResult.data?.po_number || "Unassigned PO";

    const folder = [
      isHistorical ? "Historical" : "Projects",
      sanitizePathPart(projectLabel),
      "Vendors",
      sanitizePathPart(vendorLabel),
      "Purchase Orders",
      sanitizePathPart(poLabel),
      sanitizePathPart(documentType),
    ].join("/");

    const buffer = await file.arrayBuffer();

    const uploaded = await uploadFileToMicrosoftStorage(
      folder,
      file.name,
      buffer,
      file.type || "application/octet-stream",
    );

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        vendor_id: vendorId || null,
        purchase_order_id: purchaseOrderId || null,
        milestone_id: milestoneId || null,
        document_type: documentType,
        file_name: uploaded.name,
        onedrive_item_id: uploaded.itemId,
        onedrive_path: uploaded.path,
        onedrive_web_url: uploaded.webUrl,
        revision: revision || null,
        is_historical: isHistorical,
        uploaded_by: user.id,
        mime_type: file.type || "application/octet-stream",
        file_size: uploaded.size,
        storage_provider: "microsoft_graph",
        storage_status: "uploaded",
        storage_uploaded_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: `File uploaded to Microsoft storage, but MCCS metadata save failed: ${error.message}`,
          uploaded,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      documentId: document.id,
      uploaded,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
