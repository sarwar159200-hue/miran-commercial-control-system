import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireSuperAdmin } from "@/lib/mccs/auth";

export async function POST(request: Request) {
  try {
    const { user: adminUser, supabase } = await requireSuperAdmin();
    const body = await request.json();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRole) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel." }, { status: 503 });
    }

    const admin = createAdminClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data, error } = await admin.auth.admin.createUser({
      email: String(body.email || "").trim().toLowerCase(),
      password: String(body.password || ""),
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        preferred_name: body.preferred_name,
        gender: body.gender,
        honorific: body.honorific,
      },
    });

    if (error || !data.user) return NextResponse.json({ error: error?.message || "Unable to create user" }, { status: 400 });

    await admin.from("profiles").upsert({
      id: data.user.id,
      full_name: body.full_name,
      preferred_name: body.preferred_name,
      gender: body.gender || null,
      honorific: body.honorific || null,
      job_title: body.job_title || null,
      department: body.department || null,
      is_super_admin: body.role_code === "super_admin",
      is_active: true,
    });

    const { data: role } = await admin.from("roles").select("id").eq("role_code", body.role_code).maybeSingle();
    if (role) {
      await admin.from("user_roles").upsert({
        user_id: data.user.id,
        role_id: role.id,
        granted_by: adminUser.id,
      });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: adminUser.id,
      entity_type: "user",
      entity_id: data.user.id,
      action: "CREATE_USER",
      after_data: { email: body.email, role_code: body.role_code },
    });

    return NextResponse.json({ ok: true, user_id: data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
