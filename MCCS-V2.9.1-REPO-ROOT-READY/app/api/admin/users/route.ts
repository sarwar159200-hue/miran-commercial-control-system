import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireSuperAdmin } from "@/lib/mccs/auth";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const admin = adminClient();

    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) throw error;

    const ids = data.users.map((u) => u.id);

    const [profilesResult, userRolesResult, rolesResult] = await Promise.all([
      ids.length
        ? admin
            .from("profiles")
            .select(
              "id,full_name,preferred_name,job_title,department,is_super_admin,is_active",
            )
            .in("id", ids)
        : Promise.resolve({ data: [], error: null } as any),
      ids.length
        ? admin
            .from("user_roles")
            .select("user_id,role_id")
            .in("user_id", ids)
        : Promise.resolve({ data: [], error: null } as any),
      admin
        .from("roles")
        .select("id,role_code,role_name")
        .eq("is_active", true),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (userRolesResult.error) throw userRolesResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const roles = rolesResult.data ?? [];

    const roleMap = new Map<string, any>(
      roles.map((r: any) => [String(r.id), r]),
    );

    const userRole = new Map<string, any>(
      (userRolesResult.data ?? []).map((r: any) => [
        String(r.user_id),
        roleMap.get(String(r.role_id)) ?? null,
      ]),
    );

    const profileMap = new Map<string, any>(
      (profilesResult.data ?? []).map((p: any) => [String(p.id), p]),
    );

    return NextResponse.json({
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until,
        profile: profileMap.get(u.id) ?? null,
        role: userRole.get(u.id) ?? null,
      })),
      roles,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user: actor, supabase } = await requireSuperAdmin();
    const body = await request.json();
    const admin = adminClient();

    if (body.action) {
      const id = String(body.user_id || "");

      if (!id) {
        return NextResponse.json(
          { error: "User ID is required." },
          { status: 400 },
        );
      }

      if (body.action === "suspend") {
        const { error } = await admin.auth.admin.updateUserById(id, {
          ban_duration: "876000h",
        });
        if (error) throw error;
      }

      if (body.action === "activate") {
        const { error } = await admin.auth.admin.updateUserById(id, {
          ban_duration: "none",
        });
        if (error) throw error;
      }

      if (body.action === "reset_password") {
        const password = String(body.password || "");

        if (password.length < 10) {
          return NextResponse.json(
            { error: "Temporary password must contain at least 10 characters." },
            { status: 400 },
          );
        }

        const { error } = await admin.auth.admin.updateUserById(id, {
          password,
        });
        if (error) throw error;
      }

      if (body.action === "delete") {
        const { error } = await admin.auth.admin.deleteUser(id, false);
        if (error) throw error;
      }

      if (body.action === "role") {
        const roleCode = String(body.role_code || "");

        if (!roleCode) {
          return NextResponse.json(
            { error: "Role is required." },
            { status: 400 },
          );
        }

        const { data: role, error: roleError } = await admin
          .from("roles")
          .select("id,role_code")
          .eq("role_code", roleCode)
          .eq("is_active", true)
          .maybeSingle();

        if (roleError) throw roleError;

        if (!role) {
          return NextResponse.json(
            { error: `Authorization role "${roleCode}" was not found.` },
            { status: 400 },
          );
        }

        const { error: deleteRoleError } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", id);

        if (deleteRoleError) throw deleteRoleError;

        const { error: insertRoleError } = await admin
          .from("user_roles")
          .insert({
            user_id: id,
            role_id: role.id,
            granted_by: actor.id,
          });

        if (insertRoleError) throw insertRoleError;

        const { error: profileError } = await admin
          .from("profiles")
          .update({
            is_super_admin: role.role_code === "super_admin",
          })
          .eq("id", id);

        if (profileError) throw profileError;
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        actor_user_id: actor.id,
        entity_type: "user",
        entity_id: id,
        action: `USER_${String(body.action).toUpperCase()}`,
        after_data: { role_code: body.role_code || null },
      });

      if (auditError) {
        console.error("MCCS audit log error:", auditError.message);
      }

      return NextResponse.json({ ok: true });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const roleCode = String(body.role_code || "");

    if (!email || !password || !roleCode) {
      return NextResponse.json(
        { error: "Email, temporary password, and role are required." },
        { status: 400 },
      );
    }

    const { data: selectedRole, error: selectedRoleError } = await admin
      .from("roles")
      .select("id,role_code")
      .eq("role_code", roleCode)
      .eq("is_active", true)
      .maybeSingle();

    if (selectedRoleError) throw selectedRoleError;

    if (!selectedRole) {
      return NextResponse.json(
        { error: `Authorization role "${roleCode}" was not found.` },
        { status: 400 },
      );
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        preferred_name: body.preferred_name,
        gender: body.gender,
        honorific: body.honorific,
      },
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Unable to create user" },
        { status: 400 },
      );
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      full_name: body.full_name,
      preferred_name: body.preferred_name,
      gender: body.gender || null,
      honorific: body.honorific || null,
      job_title: body.job_title || null,
      department: body.department || null,
      is_super_admin: selectedRole.role_code === "super_admin",
      is_active: true,
    });

    if (profileError) throw profileError;

    const { error: userRoleError } = await admin.from("user_roles").upsert({
      user_id: data.user.id,
      role_id: selectedRole.id,
      granted_by: actor.id,
    });

    if (userRoleError) throw userRoleError;

    return NextResponse.json({
      ok: true,
      user_id: data.user.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
