import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/mccs/auth";
import { initializeMccsFolders } from "@/lib/microsoft/onedrive";

export async function POST() {
  try {
    await requireSuperAdmin();
    const folders = await initializeMccsFolders();
    return NextResponse.json({ ok: true, folders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initialize Microsoft folders" },
      { status: 500 },
    );
  }
}
