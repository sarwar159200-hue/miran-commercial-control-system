import { NextResponse } from "next/server";
import { adminClient, requireUser } from "@/lib/mccs/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const supabase = adminClient();
    const b = await request.json();
    const item = b.item || {};
    if (!item.id) return NextResponse.json({ error: "Google Drive file result is missing." }, { status: 400 });
    const { data: document, error } = await supabase.from("documents").insert({
      project_id: String(b.project_id || ""),
      vendor_id: String(b.vendor_id || ""),
      purchase_order_id: b.purchase_order_id || b.invoice_purchase_order_id || null,
      invoice_id: b.invoice_id || null,
      milestone_id: b.milestone_id || null,
      document_title: String(b.document_title || item.name || "Document"),
      document_type: String(b.document_type || "Supporting Document"),
      document_category: String(b.document_category || "other_document"),
      file_name: String(item.name || b.file_name || "Document"),
      revision: b.revision || null,
      is_historical: Boolean(b.is_historical),
      uploaded_by: user.id,
      mime_type: String(b.mime_type || "application/octet-stream"),
      file_size: Number(item.size || b.file_size || 0),
      storage_provider: "google_drive",
      storage_status: "uploaded",
      storage_uploaded_at: new Date().toISOString(),
      google_drive_file_id: item.id,
      google_drive_folder_id: b.parent_id || null,
      google_drive_path: b.drive_path || null,
      google_drive_web_url: item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`,
    }).select("id").single();
    if (error) return NextResponse.json({ error: `File uploaded to Google Drive, but MCCS metadata save failed: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, documentId: document.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not register uploaded file." }, { status: 500 });
  }
}
