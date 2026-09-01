import "server-only";
import { requireUser } from "@/lib/mccs/auth";

export async function currentAccess() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: userRoles }] = await Promise.all([
    supabase.from("profiles").select("is_super_admin,is_active,full_name,preferred_name,honorific").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role_id").eq("user_id", user.id),
  ]);
  const roleIds=(userRoles??[]).map((x:any)=>x.role_id).filter(Boolean);
  const { data: roles } = roleIds.length ? await supabase.from("roles").select("role_code,role_name").in("id",roleIds) : {data:[] as any[]};
  const codes=new Set((roles??[]).map((r:any)=>String(r.role_code)));
  const bootstrap=user.email?.toLowerCase()==="sarwar.khalid@miranenergy.com";
  return {supabase,user,profile,roleCodes:codes,isSuperAdmin:Boolean(profile?.is_super_admin||bootstrap)};
}

export async function requireReviewAuthority() {
  const a=await currentAccess();
  if(a.profile?.is_active===false) throw new Error("Your MCCS account is suspended.");
  const allowed=a.isSuperAdmin || ["admin","commercial","discipline_engineer","project_manager"].some(r=>a.roleCodes.has(r));
  if(!allowed) throw new Error("Invoice review permission is required.");
  return a;
}
