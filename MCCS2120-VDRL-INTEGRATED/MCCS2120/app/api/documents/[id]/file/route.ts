import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleDriveFileMetadata, streamGoogleDriveFile } from "@/lib/google/drive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function extractDriveFileId(url?: string | null) {
  if (!url) return "";
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m?.[1] || "";
}

function safeAsciiFilename(name: string) {
  return name.replace(/[\r\n"\\/]/g, "_").replace(/[^\x20-\x7E]/g, "_").slice(0, 180) || "document";
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!supabase) return new Response("MCCS authentication is unavailable.", { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Authentication required.", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_active === false) return new Response("Your MCCS account is inactive.", { status: 403 });

  const { id } = await context.params;
  const source = request.nextUrl.searchParams.get("source");
  let document:any = null;
  if (source === "vdrl") {
    const { data: batch, error } = await supabase
      .from("vdrl_upload_batches")
      .select("id,original_file_name,google_drive_file_id,status")
      .eq("id", id)
      .maybeSingle();
    if (error || !batch) return new Response("VDRL file not found.", { status: 404 });
    document = { file_name: batch.original_file_name, google_drive_file_id: batch.google_drive_file_id, google_drive_web_url: null, storage_provider: "google_drive", is_deleted: false };
  } else {
    const { data: row, error } = await supabase
      .from("documents")
      .select("id,file_name,google_drive_file_id,google_drive_web_url,storage_provider,is_deleted")
      .eq("id", id)
      .maybeSingle();
    if (error || !row || row.is_deleted) return new Response("Document not found.", { status: 404 });
    document = row;
  }
  if (document.storage_provider !== "google_drive") return new Response("This document is not stored in Google Drive.", { status: 409 });

  const fileId = String(document.google_drive_file_id || extractDriveFileId(document.google_drive_web_url));
  if (!fileId) return new Response("Google Drive file identifier is missing.", { status: 409 });

  try {
    const metadata = await getGoogleDriveFileMetadata(fileId);
    if (metadata.trashed) return new Response("The Google Drive file has been moved to trash.", { status: 410 });

    const upstream = await streamGoogleDriveFile(fileId, request.headers.get("range"));
    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text();
      return new Response(`Google Drive could not provide this file (${upstream.status}). ${text}`, { status: upstream.status });
    }

    const requestedDownload = request.nextUrl.searchParams.get("download") === "1";
    const name = String(document.file_name || metadata.name || "document");
    const ascii = safeAsciiFilename(name);
    const disposition = requestedDownload ? "attachment" : "inline";
    const headers = new Headers();
    headers.set("Content-Type", metadata.mimeType || upstream.headers.get("content-type") || "application/octet-stream");
    headers.set("Content-Disposition", `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Document access failed.", { status: 500 });
  }
}
