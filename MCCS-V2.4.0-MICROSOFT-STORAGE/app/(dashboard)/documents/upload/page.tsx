import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MicrosoftUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await createClient();
  if (!s) return null;

  const [pr, por, vr, mr] = await Promise.all([
    s.from("projects").select("id,project_code,project_name").eq("is_active", true).order("project_name"),
    s.from("purchase_orders").select("id,po_number").eq("is_deleted", false).order("po_number"),
    s.from("vendors").select("id,vendor_name").eq("is_active", true).order("vendor_name"),
    s.from("payment_milestones").select("id,milestone_name").order("milestone_name"),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
            Microsoft Storage
          </div>
          <h1 className="mt-2 text-3xl font-bold">Upload Commercial Document</h1>
          <p className="mt-2 text-sm text-slate-500">
            Upload directly to the configured Microsoft OneDrive or SharePoint drive and register the file in MCCS.
          </p>
        </div>
        <Link href="/documents" className="font-bold text-blue-700">
          Back
        </Link>
      </div>

      <MicrosoftUploadForm
        projects={pr.data ?? []}
        purchaseOrders={por.data ?? []}
        vendors={vr.data ?? []}
        milestones={mr.data ?? []}
      />
    </div>
  );
}
