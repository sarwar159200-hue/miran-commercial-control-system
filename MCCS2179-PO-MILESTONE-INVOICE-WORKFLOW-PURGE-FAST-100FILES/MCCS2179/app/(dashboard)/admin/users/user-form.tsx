"use client";

import { useState } from "react";

export function UserForm({
  roles,
  disabled = false,
}: {
  roles: { role_code: string; role_name: string }[];
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return;

    setError("");
    setMessage("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const payload:any = Object.fromEntries(fd.entries());
    const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    payload.notify_user=submitter?.value==="notify"?"true":"false";

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Unable to create user");
      return;
    }

    setMessage(data.warning ? `${data.message || "User account created."} ${data.warning}` : (data.message || "User account created successfully."));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="mccs-card rounded-2xl p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <F l="Full Name *"><input name="full_name" required className="input" disabled={disabled} /></F>
        <F l="Preferred Name *"><input name="preferred_name" required className="input" disabled={disabled} /></F>
        <F l="Email *"><input name="email" type="email" required className="input" disabled={disabled} /></F>
        <F l="Temporary Password *"><input name="password" type="password" minLength={10} required className="input" disabled={disabled} /></F>
        <F l="Gender">
          <select name="gender" className="input" disabled={disabled}>
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </F>
        <F l="Honorific"><input name="honorific" className="input" placeholder="Kak / Mrs. / Mr." disabled={disabled} /></F>
        <F l="Job Title"><input name="job_title" className="input" disabled={disabled} /></F>
        <F l="Department"><input name="department" className="input" disabled={disabled} /></F>
        <F l="Profile Picture URL"><input name="avatar_url" type="url" className="input" placeholder="https://.../photo.jpg" disabled={disabled} /></F>
        <F l="Role">
          <select name="role_code" required className="input" disabled={disabled || !roles.length} defaultValue="">
            <option value="" disabled>Select authorization role</option>
            {roles.map((r) => (
              <option key={r.role_code} value={r.role_code}>
                {r.role_name}
              </option>
            ))}
          </select>
        </F>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button type="submit" value="create" disabled={loading || disabled || !roles.length} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? "Creating..." : "Create Account"}
        </button>
        <button type="submit" value="notify" disabled={loading || disabled || !roles.length} className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? "Creating..." : "Create & Notify User"}
        </button>
      </div>
      <p className="mt-3 text-right text-xs text-slate-500">Create & Notify sends a warm welcome email with the login link, username/email and the temporary password entered above.</p>
    </form>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-700">{l}</span>
      {children}
    </label>
  );
}
