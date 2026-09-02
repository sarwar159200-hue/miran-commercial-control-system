"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("sarwar.khalid@miranenergy.com");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setMessage("Password reset instructions have been sent if this account is registered.");
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
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Reset password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your authorized account email and MCCS will request a secure recovery link.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Email address
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </div>

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
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-blue-700 hover:underline">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}
