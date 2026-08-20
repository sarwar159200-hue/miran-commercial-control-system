import { NextResponse } from "next/server";
import { getOneDriveConfigStatus } from "@/lib/microsoft/onedrive";

export async function GET() {
  const status = getOneDriveConfigStatus();

  return NextResponse.json({
    configured: status.configured,
    driveIdConfigured: status.driveIdConfigured,
    rootFolder: status.rootFolder,
    missing: status.missing,
  });
}
