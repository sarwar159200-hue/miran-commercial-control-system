import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const q = await searchParams;
  const s = await createClient();
  if (!s) return null;

  const r = await s
    .from("documents")
    .select(
      "id,document_type,file_name,revision,onedrive_path,onedrive_web_url,is_historical,uploaded_at,storage_status,file_size",
    )
    .order("uploaded_at", { ascending: false });

  const rows = r.data ?? [];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">
            MCCS
          </div>
          <h1 className="mt-2 text-3xl font-bold">Documents</h1>
          <p className="mt-2 text-sm text-slate-500">
            Commercial document index with Microsoft OneDrive / SharePoint storage.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/documents/new"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
          >
            Metadata Only
          </Link>
          <Link
            href="/documents/upload"
            className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white dark:bg-blue-600"
          >
            Upload File
          </Link>
        </div>
      </div>

      {q.uploaded ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
          File uploaded and registered successfully.
        </div>
      ) : null}

      {r.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {r.error.message}
        </div>
      ) : null}

      <div className="mccs-card mt-7 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Revision</th>
                <th className="px-5 py-3">Storage</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Historical</th>
                <th className="px-5 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {rows.map((x: any) => (
                <tr key={x.id}>
                  <td className="px-5 py-4 font-bold">{x.document_type}</td>
                  <td className="px-5 py-4">
                    {x.onedrive_web_url ? (
                      <a
                        href={x.onedrive_web_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {x.file_name}
                      </a>
                    ) : (
                      x.file_name
                    )}
                  </td>
                  <td className="px-5 py-4">{x.revision || "—"}</td>
                  <td className="px-5 py-4">
                    {x.storage_status === "uploaded" ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Microsoft
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        Metadata
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {x.file_size ? `${(Number(x.file_size) / 1024 / 1024).toFixed(2)} MB` : "—"}
                  </td>
                  <td className="px-5 py-4">{x.is_historical ? "Yes" : "No"}</td>
                  <td className="px-5 py-4">{String(x.uploaded_at).slice(0, 10)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No commercial document records yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
