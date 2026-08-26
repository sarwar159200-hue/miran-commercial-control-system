import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { PresenceHeartbeat, AccessGuard } from "@/components/presence-heartbeat";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function greeting(profile: any, email?: string | null) {
  const first =
    profile?.preferred_name ||
    profile?.full_name?.split(" ")?.[0] ||
    email?.split("@")?.[0] ||
    "User";

  if (profile?.honorific) return `Welcome, ${profile.honorific} ${first}`;
  if (profile?.gender === "female") return `Welcome, Mrs. ${first}`;
  if (profile?.gender === "male") return `Welcome, Kak ${first}`;
  return `Welcome, ${first}`;
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: userRoles }, { data: tabPermissions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, preferred_name, gender, honorific, is_super_admin, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role_id").eq("user_id", user.id),
    supabase.from("user_tab_permissions").select("tab_key,allowed").eq("user_id",user.id),
  ]);

  const roleIds = (userRoles ?? []).map((x: any) => x.role_id).filter(Boolean);
  const { data: roles } = roleIds.length
    ? await supabase.from("roles").select("role_code").in("id", roleIds)
    : { data: [] as any[] };
  const roleCodes = new Set((roles ?? []).map((r: any) => String(r.role_code).toLowerCase()));
  const bootstrapSuperAdmin = user.email?.toLowerCase() === "sarwar.khalid@miranenergy.com";
  const isSuperAdmin = Boolean(profile?.is_super_admin || bootstrapSuperAdmin || roleCodes.has("super_admin"));
  const canAdmin = isSuperAdmin || roleCodes.has("admin");
  const defaultTabs=["dashboard","vendors","projects","purchase_orders","payment_milestones","invoices","payments","vdrl","documents","reports","messages",...(canAdmin?["administration"]:[])];
  const allowedTabs=isSuperAdmin?defaultTabs:((tabPermissions??[]).length?(tabPermissions??[]).filter((x:any)=>x.allowed).map((x:any)=>String(x.tab_key)):defaultTabs);

  return (
    <div className="flex min-h-screen bg-[#f5f7fb] dark:bg-[#08111f]">
      <PresenceHeartbeat />
      <Sidebar canAdmin={canAdmin} allowedTabs={allowedTabs} />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-7 backdrop-blur">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              Miran Energy LTD
            </div>
            <div className="mt-1 text-sm font-bold text-slate-800">
              {greeting(profile, user.email)}
            </div>
            <div className="text-[11px] text-slate-500">{user.email}</div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-4 pl-8">
            <GlobalSearch />
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-extrabold text-slate-600 shadow-sm" title={profile?.full_name || user.email || "User"}>
                {(profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture) ? <img src={profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture} alt="User profile" className="h-full w-full object-cover" /> : <span>{String(profile?.preferred_name || profile?.full_name || user.email || "U").slice(0,2).toUpperCase()}</span>}
              </div>
              {isSuperAdmin ? (
                <div className="hidden rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 md:block">
                  Super Admin
                </div>
              ) : roleCodes.has("admin") ? (
                <div className="hidden rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 md:block">
                  Admin
                </div>
              ) : null}
              <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:block">
                Secure session
              </div>
              <SignOutButton />
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-8"><AccessGuard allowedTabs={allowedTabs} canAdmin={canAdmin}>{children}</AccessGuard></div>
      </main>
    </div>
  );
}
