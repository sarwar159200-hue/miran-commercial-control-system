import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();

  // If Supabase is not configured yet, send the user to login instead of
  // breaking the production build during prerender.
  if (!supabase) {
    redirect("/login?config=missing");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-7 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Miran Commercial Control System
            </div>
            <div className="mt-1 text-sm text-slate-700">{user.email}</div>
          </div>
          <SignOutButton />
        </header>
        <div className="p-7">{children}</div>
      </main>
    </div>
  );
}
