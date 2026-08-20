import "server-only";

export type MicrosoftStorageStatus = {
  configured: boolean;
  missing: string[];
  rootFolder: string;
  driveIdConfigured: boolean;
};

const required = [
  "MICROSOFT_TENANT_ID",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "ONEDRIVE_DRIVE_ID",
] as const;

export function getOneDriveConfigStatus(): MicrosoftStorageStatus {
  const missing = required.filter((key) => !process.env[key]);

  return {
    configured: missing.length === 0,
    missing: [...missing],
    rootFolder: process.env.ONEDRIVE_ROOT_FOLDER || "MCCS",
    driveIdConfigured: Boolean(process.env.ONEDRIVE_DRIVE_ID),
  };
}

export async function getMicrosoftGraphAppToken(): Promise<string> {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph credentials are not configured.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Microsoft token request failed (${response.status}): ${text}`);
  }

  const data = JSON.parse(text) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Microsoft token response did not contain an access token.");
  }

  return data.access_token;
}

function driveId() {
  const value = process.env.ONEDRIVE_DRIVE_ID;
  if (!value) throw new Error("ONEDRIVE_DRIVE_ID is not configured.");
  return value;
}

export async function getDriveInfo() {
  const token = await getMicrosoftGraphAppToken();
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId())}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Microsoft Drive check failed (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

export function sanitizePathPart(value: string) {
  return value
    .replace(/[\\/:*?"<>|#%]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Unknown";
}

export function encodeGraphPath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export async function ensureFolder(relativePath: string) {
  const token = await getMicrosoftGraphAppToken();
  const drive = driveId();
  const root = process.env.ONEDRIVE_ROOT_FOLDER || "MCCS";

  const parts = [root, ...relativePath.split("/").filter(Boolean)].map(sanitizePathPart);
  let parentPath = "";

  for (const part of parts) {
    const parentEndpoint = parentPath
      ? `root:/${encodeGraphPath(parentPath)}:/children`
      : "root/children";

    const list = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(drive)}/${parentEndpoint}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!list.ok) {
      throw new Error(`Unable to inspect Microsoft folder path (${list.status}).`);
    }

    const body = (await list.json()) as { value?: Array<{ name?: string; folder?: unknown }> };
    const found = body.value?.find((item) => item.name === part && item.folder);

    if (!found) {
      const create = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(drive)}/${parentEndpoint}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: part,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
          }),
          cache: "no-store",
        },
      );

      if (!create.ok && create.status !== 409) {
        const err = await create.text();
        throw new Error(`Unable to create Microsoft folder "${part}" (${create.status}): ${err}`);
      }
    }

    parentPath = parentPath ? `${parentPath}/${part}` : part;
  }

  return parentPath;
}

export async function uploadFileToMicrosoftStorage(
  relativeFolder: string,
  fileName: string,
  content: ArrayBuffer,
  contentType = "application/octet-stream",
) {
  const drive = driveId();
  const root = process.env.ONEDRIVE_ROOT_FOLDER || "MCCS";
  const folderPath = await ensureFolder(relativeFolder);
  const cleanName = sanitizePathPart(fileName);
  const fullPath = `${folderPath}/${cleanName}`;
  const token = await getMicrosoftGraphAppToken();

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(drive)}/root:/${encodeGraphPath(fullPath)}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: content,
      cache: "no-store",
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Microsoft file upload failed (${response.status}): ${text}`);
  }

  const item = JSON.parse(text) as {
    id?: string;
    name?: string;
    size?: number;
    webUrl?: string;
  };

  return {
    itemId: item.id || "",
    name: item.name || cleanName,
    size: item.size || content.byteLength,
    webUrl: item.webUrl || "",
    path: `${root}/${relativeFolder}/${cleanName}`.replace(/\/+/g, "/"),
  };
}

export async function initializeMccsFolders() {
  const folders = [
    "Projects",
    "Purchase Orders",
    "Invoices",
    "Payments",
    "Vendors",
    "Supporting Documents",
    "Historical",
  ];

  const created: string[] = [];

  for (const folder of folders) {
    created.push(await ensureFolder(folder));
  }

  return created;
}
