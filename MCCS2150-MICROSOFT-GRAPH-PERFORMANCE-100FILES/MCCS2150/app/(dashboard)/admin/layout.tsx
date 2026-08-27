import { redirect } from "next/navigation";
import { currentAccess } from "@/lib/mccs/invoice-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await currentAccess();
  const isAdmin = access.isSuperAdmin || access.roleCodes.has("admin");
  if (!isAdmin) redirect("/dashboard");
  return children;
}
