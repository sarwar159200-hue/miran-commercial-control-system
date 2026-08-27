import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireSuperAdmin } from "@/lib/mccs/auth";

function esc(value:unknown){return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));}

function appUrl(){
  const explicit=String(process.env.NEXT_PUBLIC_APP_URL||process.env.MCCS_APP_URL||"").trim().replace(/\/$/,"");
  if(explicit)return explicit;
  const host=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
  return host?`https://${host}`:"";
}

async function sendMccsEmail(input:{to:string;subject:string;html:string}){
  const apiKey=String(process.env.RESEND_API_KEY||"");
  const from=String(process.env.MCCS_EMAIL_FROM||"");
  if(!apiKey||!from)throw new Error("Email notification is not configured. Add RESEND_API_KEY and MCCS_EMAIL_FROM in Vercel.");
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[input.to],subject:input.subject,html:input.html}),cache:"no-store"});
  if(!r.ok){const t=await r.text();throw new Error(`Email provider rejected the message (${r.status}): ${t.slice(0,220)}`);}
}

async function sendWelcomeEmail(input:{email:string;name:string;password:string;role?:string}){
  const login=appUrl();
  const role=input.role?`<p style="margin:0 0 12px"><b>Access role:</b> ${esc(input.role)}</p>`:"";
  const button=login?`<p style="margin:24px 0"><a href="${esc(login)}" style="display:inline-block;background:#07111f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Open MCCS</a></p>`:"";
  await sendMccsEmail({to:input.email,subject:"Welcome to MCCS – Your Miran Commercial Control System Account",html:`<div style="font-family:Arial,sans-serif;color:#122033;line-height:1.55;max-width:680px;margin:auto"><h2 style="color:#0b4edb">Welcome to MCCS</h2><p>Dear ${esc(input.name||input.email)},</p><p>Welcome to the <b>Miran Commercial Control System (MCCS)</b>. Your account has been created and access has been granted.</p><div style="background:#f6f8fb;border:1px solid #dfe6ef;border-radius:12px;padding:18px;margin:18px 0"><p style="margin:0 0 12px"><b>Username / Email:</b> ${esc(input.email)}</p><p style="margin:0 0 12px"><b>Temporary password:</b> ${esc(input.password)}</p>${role}</div>${button}${login?`<p style="font-size:13px;color:#5b6778">Login link: ${esc(login)}</p>`:""}<p>For security, please change your temporary password after signing in if you prefer to use your own secure password. Do not share your password with anyone.</p><p>We are pleased to have you on MCCS and hope the system makes your commercial and project-control work easier.</p><p style="margin-top:24px">Best Regards,<br><b>MCCS Administration<br>Miran Energy Ltd</b></p></div>`});
}

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

    const [profilesResult, userRolesResult, rolesResult, tabPermissionsResult] = await Promise.all([
      ids.length
        ? admin
            .from("profiles")
            .select(
              "id,full_name,preferred_name,job_title,department,avatar_url,is_super_admin,is_active",
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
      ids.length ? admin.from("user_tab_permissions").select("user_id,tab_key,allowed").in("user_id",ids) : Promise.resolve({data:[],error:null} as any),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (userRolesResult.error) throw userRolesResult.error;
    if (rolesResult.error) throw rolesResult.error;
    if (tabPermissionsResult.error) throw tabPermissionsResult.error;

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

    const permsByUser=new Map<string,Record<string,boolean>>();
    for(const row of (tabPermissionsResult.data??[]) as any[]){const rec=permsByUser.get(String(row.user_id))||{};rec[String(row.tab_key)]=Boolean(row.allowed);permsByUser.set(String(row.user_id),rec);}
    return NextResponse.json({
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until,
        profile: profileMap.get(u.id) ?? null,
        role: userRole.get(u.id) ?? null,
        tab_permissions: permsByUser.get(u.id) ?? {},
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

      if (body.action === "notify_user") {
        const password=String(body.password||"");
        if(password.length<10)return NextResponse.json({error:"Enter a new temporary password of at least 10 characters before sending the welcome email."},{status:400});
        const userResult=await admin.auth.admin.getUserById(id);
        if(userResult.error||!userResult.data.user?.email)throw userResult.error||new Error("User email was not found.");
        const {error:passwordError}=await admin.auth.admin.updateUserById(id,{password});
        if(passwordError)throw passwordError;
        const {data:profile}=await admin.from("profiles").select("full_name,preferred_name").eq("id",id).maybeSingle();
        await sendWelcomeEmail({email:userResult.data.user.email,name:String(profile?.preferred_name||profile?.full_name||userResult.data.user.email),password,role:String(body.role_name||"")});
      }

      if (body.action === "delete") {
        const { error } = await admin.auth.admin.deleteUser(id, false);
        if (error) throw error;
      }

      if (body.action === "tabs") {
        const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
        const rows = Object.entries(permissions).map(([tab_key,allowed])=>({user_id:id,tab_key,allowed:Boolean(allowed),granted_by:actor.id,updated_at:new Date().toISOString()}));
        if(rows.length){const {error}=await admin.from("user_tab_permissions").upsert(rows,{onConflict:"user_id,tab_key"});if(error)throw error;}
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

      return NextResponse.json({ ok: true, message: body.action === "notify_user" ? "Welcome email sent successfully with the new temporary password and MCCS login link." : undefined });
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
      avatar_url: body.avatar_url || null,
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
    const tabKeys=["dashboard","vendors","projects","purchase_orders","payment_milestones","invoices","payments","vdrl","documents","reports","messages","administration"];
    const {error:permError}=await admin.from("user_tab_permissions").upsert(tabKeys.map(tab_key=>({user_id:data.user!.id,tab_key,allowed:tab_key!=="administration"||["admin","super_admin"].includes(selectedRole.role_code),granted_by:actor.id})),{onConflict:"user_id,tab_key"});
    if(permError)throw permError;

    let warning="";
    if(String(body.notify_user||"")==="true"){
      try{await sendWelcomeEmail({email,name:String(body.preferred_name||body.full_name||email),password,role:String(selectedRole.role_code||roleCode)});}
      catch(e){warning=`Account created, but the welcome email was not sent: ${e instanceof Error?e.message:"Email error"}`;}
    }

    return NextResponse.json({
      ok: true,
      user_id: data.user.id,
      warning,
      message: warning?"User account created.":String(body.notify_user||"")==="true"?"User account created and welcome email sent.":"User account created successfully.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
