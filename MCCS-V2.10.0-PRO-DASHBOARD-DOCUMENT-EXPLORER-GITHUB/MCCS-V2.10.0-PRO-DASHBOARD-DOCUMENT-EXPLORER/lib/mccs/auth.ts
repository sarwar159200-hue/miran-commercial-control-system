import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return { supabase, user };
}

export async function requireSuperAdmin() {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin,is_active")
    .eq("id", user.id)
    .maybeSingle();

  const emailBootstrap = user.email?.toLowerCase() === "sarwar.khalid@miranenergy.com";

  if ((!profile?.is_super_admin && !emailBootstrap) || profile?.is_active === false) {
    throw new Error("Super Admin permission is required.");
  }

  return { supabase, user };
}
