import { NextResponse } from "next/server";
import {
  getDriveInfo,
  getOneDriveConfigStatus,
} from "@/lib/microsoft/onedrive";

export async function GET() {
  const config = getOneDriveConfigStatus();

  if (!config.configured) {
    return NextResponse.json({
      configured: false,
      missing: config.missing,
      rootFolder: config.rootFolder,
    });
  }

  try {
    const drive = await getDriveInfo();

    return NextResponse.json({
      configured: true,
      connected: true,
      rootFolder: config.rootFolder,
      drive: {
        id: drive.id,
        name: drive.name,
        driveType: drive.driveType,
        webUrl: drive.webUrl,
        quota: drive.quota
          ? {
              total: drive.quota.total,
              used: drive.quota.used,
              remaining: drive.quota.remaining,
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        rootFolder: config.rootFolder,
        error: error instanceof Error ? error.message : "Microsoft connection failed",
      },
      { status: 502 },
    );
  }
}
