import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireUser } from "@/lib/mccs/auth";

export const runtime = "nodejs";

function validGoogleSession(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.googleapis.com" && u.pathname.startsWith("/upload/drive/v3/files");
  } catch { return false; }
}

function validUploadToken(sessionUrl:string,token:string){
  const secret=process.env.MCCS_UPLOAD_TOKEN_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||"";
  if(!secret||!token)return false;
  const [expiresRaw,sig]=token.split(".");
  const expires=Number(expiresRaw);
  if(!expires||expires<Date.now()||!sig)return false;
  const expected=createHmac("sha256",secret).update(`${sessionUrl}|${expires}`).digest("hex");
  try{return timingSafeEqual(Buffer.from(sig,"hex"),Buffer.from(expected,"hex"));}catch{return false;}
}

export async function PUT(request: Request) {
  try {
    const sessionUrl = request.headers.get("x-mccs-upload-session") || "";
    const uploadToken=request.headers.get("x-mccs-upload-token")||"";
    // Auth is verified once when the resumable session is created. A short-lived,
    // HMAC-bound token avoids a Supabase auth round-trip for every 4 MB chunk.
    if(!validUploadToken(sessionUrl,uploadToken)) await requireUser();
    const contentRange = request.headers.get("content-range") || "";
    const contentType = request.headers.get("content-type") || "application/octet-stream";
    if (!validGoogleSession(sessionUrl)) return NextResponse.json({ error: "Invalid Google Drive upload session." }, { status: 400 });
    if (!contentRange) return NextResponse.json({ error: "Missing Content-Range." }, { status: 400 });
    const body = await request.arrayBuffer();
    const upstream = await fetch(sessionUrl, { method: "PUT", headers: { "Content-Type": contentType, "Content-Length": String(body.byteLength), "Content-Range": contentRange }, body, cache: "no-store" });
    const text = await upstream.text();
    if (upstream.status === 308) return NextResponse.json({ ok: true, complete: false, range: upstream.headers.get("range") || null }, { status: 200 });
    if (!upstream.ok) return NextResponse.json({ error: `Google Drive upload failed (${upstream.status}): ${text}` }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 500 });
    let item: any = {};
    try { item = text ? JSON.parse(text) : {}; } catch { item = {}; }
    return NextResponse.json({ ok: true, complete: true, item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chunk upload failed." }, { status: 500 });
  }
}
