"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MicrosoftUploadForm({
  projects,
  purchaseOrders,
  vendors,
  milestones,
}: {
  projects: any[];
  purchaseOrders: any[];
  vendors: any[];
  milestones: any[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setProgress("Uploading to Microsoft storage...");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    form.set(
      "is_historical",
      (event.currentTarget.elements.namedItem("is_historical") as HTMLInputElement)?.checked
        ? "true"
        : "false",
    );

    try {
      const response = await fetch("/api/onedrive/upload", {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setProgress("Upload completed. Saving MCCS record...");
      router.push("/documents?uploaded=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mccs-card mt-7 rounded-2xl p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="File *">
          <input name="file" type="file" required className="input" />
        </Field>

        <Field label="Document Type *">
          <input
            name="document_type"
            required
            className="input"
            placeholder="PO / Contract / Invoice / Approval"
          />
        </Field>

        <Field label="Project">
          <select name="project_id" className="input">
            <option value="">Derive from PO / Unassigned</option>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.project_code} — {x.project_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Purchase Order">
          <select name="purchase_order_id" className="input">
            <option value="">Unassigned</option>
            {purchaseOrders.map((x) => (
              <option key={x.id} value={x.id}>
                {x.po_number}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Vendor">
          <select name="vendor_id" className="input">
            <option value="">Unassigned</option>
            {vendors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.vendor_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Payment Milestone">
          <select name="milestone_id" className="input">
            <option value="">Unassigned</option>
            {milestones.map((x) => (
              <option key={x.id} value={x.id}>
                {x.milestone_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Revision">
          <input name="revision" className="input" placeholder="Rev 0 / Rev A" />
        </Field>
      </div>

      <label className="mt-5 flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="is_historical" />
        Historical document
      </label>

      {progress ? (
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">
          {progress}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-7 flex justify-end">
        <button
          disabled={loading}
          className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-blue-600"
        >
          {loading ? "Uploading..." : "Upload to Microsoft Storage"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      {children}
    </label>
  );
}
