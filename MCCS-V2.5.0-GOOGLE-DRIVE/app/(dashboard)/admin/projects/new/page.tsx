import Link from "next/link";
import { createProject } from "../../../_actions/commercial";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
            Administration
          </div>
          <h1 className="mt-2 text-3xl font-bold">Add Project</h1>
        </div>
        <Link href="/admin/projects" className="text-sm font-bold text-blue-700">
          Back
        </Link>
      </div>

      {params.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {params.error}
        </div>
      ) : null}

      <form action={createProject} className="mccs-card mt-7 rounded-2xl p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Project Code *">
            <input name="project_code" required className="input" placeholder="MIRAN-EPF" />
          </Field>
          <Field label="Project Name *">
            <input name="project_name" required className="input" placeholder="Miran Energy EPF Project" />
          </Field>
          <Field label="Start Date">
            <input name="start_date" type="date" className="input" />
          </Field>
          <Field label="Planned Finish Date">
            <input name="planned_finish_date" type="date" className="input" />
          </Field>
        </div>

        <Field label="Description">
          <textarea name="description" rows={4} className="input mt-5" />
        </Field>

        <div className="mt-7 flex justify-end">
          <button className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white">
            Create Project
          </button>
        </div>
      </form>
    </div>
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
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
