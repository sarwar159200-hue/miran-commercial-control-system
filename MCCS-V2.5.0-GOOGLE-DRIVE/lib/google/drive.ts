import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is incomplete.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getGoogleDriveConfigStatus() {
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_DRIVE_ROOT_FOLDER_ID"] as const;
  const missing = required.filter((key) => !process.env[key]);
  return { configured: missing.length === 0, missing, rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "" };
}

export function sanitizeDriveName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 150) || "Unknown";
}

export async function saveGoogleRefreshToken(refreshToken: string) {
  const admin = adminClient();
  const { error } = await admin.from("google_drive_config").upsert({
    id: 1,
    refresh_token: refreshToken,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save Google Drive authorization: ${error.message}`);
}

async function getDriveConfigRow() {
  const admin = adminClient();
  const { data, error } = await admin.from("google_drive_config").select("refresh_token,root_folder_id").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Could not read Google Drive authorization: ${error.message}`);
  if (!data?.refresh_token) throw new Error("Google Drive is not connected. Connect it from Administration → Google Drive Configuration.");
  return data as { refresh_token: string; root_folder_id?: string | null };
}

async function getRefreshToken() {
  const row = await getDriveConfigRow();
  return String(row.refresh_token);
}

export async function getGoogleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured.");

  const refreshToken = await getRefreshToken();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google token refresh failed (${response.status}): ${text}`);
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) throw new Error("Google did not return an access token.");
  return json.access_token;
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const token = await getGoogleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${GOOGLE_DRIVE_API}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function getGoogleDriveConnectionStatus() {
  const config = getGoogleDriveConfigStatus();
  if (!config.configured) return { ...config, connected: false, folderName: null as string | null };
  try {
    await getGoogleAccessToken();
    const row = await getDriveConfigRow();
    const rootId = row.root_folder_id || config.rootFolderId;
    const root = await driveFetch(`/files/${encodeURIComponent(rootId)}?fields=id,name,mimeType,trashed`);
    if (!root.ok) return { ...config, connected: false, folderName: null as string | null };
    const data = await root.json() as { name?: string; trashed?: boolean };
    return { ...config, connected: !data.trashed, folderName: data.name || null };
  } catch {
    return { ...config, connected: false, folderName: null as string | null };
  }
}

export async function ensureGoogleFolder(parentId: string, name: string) {
  const safeName = sanitizeDriveName(name);
  const q = `'${escapeQuery(parentId)}' in parents and name='${escapeQuery(safeName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const lookup = await driveFetch(`/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`);
  const lookupText = await lookup.text();
  if (!lookup.ok) throw new Error(`Google Drive folder lookup failed (${lookup.status}): ${lookupText}`);
  const files = (JSON.parse(lookupText) as { files?: Array<{ id: string; name: string }> }).files || [];
  if (files[0]?.id) return files[0].id;

  const create = await driveFetch("/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: safeName, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const createText = await create.text();
  if (!create.ok) throw new Error(`Google Drive folder creation failed (${create.status}): ${createText}`);
  return (JSON.parse(createText) as { id: string }).id;
}


export async function ensureConfiguredGoogleRoot() {
  const configuredId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "";
  let rootId = configuredId;
  if (configuredId) {
    try {
      const check = await driveFetch(`/files/${encodeURIComponent(configuredId)}?fields=id,name,trashed`);
      if (!check.ok) rootId = "";
    } catch {
      rootId = "";
    }
  }
  if (!rootId) rootId = await ensureGoogleFolder("root", "MCCS - Miran Commercial Control");
  const admin = adminClient();
  const { error } = await admin.from("google_drive_config").update({ root_folder_id: rootId, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error(`Could not save Google Drive root folder: ${error.message}`);
  return rootId;
}

export async function ensureGoogleFolderPath(parts: string[]) {
  const row = await getDriveConfigRow();
  let parent = row.root_folder_id || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!parent) throw new Error("Google Drive root folder is not configured.");
  for (const part of parts.filter(Boolean)) parent = await ensureGoogleFolder(parent, part);
  return parent;
}

export async function uploadFileToGoogleDrive(folderParts: string[], fileName: string, content: ArrayBuffer, mimeType: string) {
  const parentId = await ensureGoogleFolderPath(folderParts);
  const token = await getGoogleAccessToken();
  const boundary = `mccs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: sanitizeDriveName(fileName), parents: [parentId] });
  const header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(header, "utf8"), Buffer.from(content), Buffer.from(footer, "utf8")]);

  const response = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,webViewLink,webContentLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status}): ${text}`);
  const item = JSON.parse(text) as { id?: string; name?: string; size?: string; webViewLink?: string; webContentLink?: string };
  return {
    fileId: item.id || "",
    name: item.name || sanitizeDriveName(fileName),
    size: Number(item.size || content.byteLength),
    webViewLink: item.webViewLink || (item.id ? `https://drive.google.com/file/d/${item.id}/view` : ""),
    webContentLink: item.webContentLink || "",
    parentId,
    path: folderParts.map(sanitizeDriveName).join("/"),
  };
}
