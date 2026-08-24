import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/mccs/auth";

export async function GET() {
  try {
    await requireSuperAdmin();

    return NextResponse.json({
      supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      publishableKeyConfigured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      environment: process.env.VERCEL_ENV || "unknown",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run diagnostics" },
      { status: 500 }
    );
  }
}
