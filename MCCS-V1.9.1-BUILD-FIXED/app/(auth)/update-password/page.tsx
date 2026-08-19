"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
        return;
      }

      setMessage("Password updated successfully. You can now return to MCCS.");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <Image
          src="/miran-energy-logo.png"
          alt="Miran Energy LTD"
          width={300}
          height={95}
          className="h-auto w-full max-w-[240px] object-contain"
        />

        <div className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          MCCS
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Choose a new password</h1>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />

          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-slate-950 px-4 py-3.5 font-semibold text-white disabled:opacity-60"
            type="submit"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-blue-700 hover:underline">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}
