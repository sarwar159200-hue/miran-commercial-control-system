import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { ThemeToggle } from "@/components/theme-toggle";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name, gender, honorific, is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen bg-[#f5f7fb] dark:bg-[#08111f]">
      <PresenceHeartbeat />
      <Sidebar />
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

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {profile?.is_super_admin ? (
              <div className="hidden rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 md:block">
                Super Admin
              </div>
            ) : null}
            <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:block">
              Secure session
            </div>
            <SignOutButton />
          </div>
        </header>

        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
