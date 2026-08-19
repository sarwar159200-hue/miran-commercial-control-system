import "server-only";

export type OneDriveConfigStatus = {
  configured: boolean;
  missing: string[];
  driveIdConfigured: boolean;
  rootFolder: string;
};

const requiredServerVars = [
  "MICROSOFT_TENANT_ID",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "ONEDRIVE_DRIVE_ID",
] as const;

export function getOneDriveConfigStatus(): OneDriveConfigStatus {
  const missing = requiredServerVars.filter((key) => !process.env[key]);

  return {
    configured: missing.length === 0,
    missing: [...missing],
    driveIdConfigured: Boolean(process.env.ONEDRIVE_DRIVE_ID),
    rootFolder: process.env.ONEDRIVE_ROOT_FOLDER || "MCCS",
  };
}

export async function getMicrosoftGraphAppToken(): Promise<string> {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph server credentials are not configured.");
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
    }
  );

  if (!response.ok) {
    throw new Error(`Microsoft token request failed (${response.status}).`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Microsoft token response did not contain an access token.");
  }

  return data.access_token;
}

export async function uploadSmallFileToOneDrive(
  relativePath: string,
  content: ArrayBuffer,
  contentType = "application/octet-stream"
) {
  const driveId = process.env.ONEDRIVE_DRIVE_ID;
  const rootFolder = process.env.ONEDRIVE_ROOT_FOLDER || "MCCS";

  if (!driveId) {
    throw new Error("ONEDRIVE_DRIVE_ID is not configured.");
  }

  const token = await getMicrosoftGraphAppToken();
  const cleanPath = `${rootFolder}/${relativePath}`
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${cleanPath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: content,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OneDrive upload failed (${response.status}): ${text}`);
  }

  return response.json();
}
