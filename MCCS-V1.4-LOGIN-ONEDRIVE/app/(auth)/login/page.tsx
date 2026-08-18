"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_EMAIL = "prjoect.invoices@miranenergy.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-slate-50 p-12 lg:flex lg:flex-col lg:justify-between">
            <div>
              <Image
                src="/miran-energy-logo.png"
                alt="Miran Energy LTD"
                width={420}
                height={130}
                priority
                className="h-auto w-full max-w-sm object-contain"
              />
            </div>

            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Miran Energy LTD
              </div>
              <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-950">
                Miran Commercial
                <br />
                Control System
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
                Contracts, commitments, payment milestones, invoice assurance and payment control in one governed workspace.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              MCCS • Internal Commercial Management Platform
            </div>
          </section>

          <section className="p-8 sm:p-12">
            <div className="mx-auto max-w-md">
              <div className="mb-8 lg:hidden">
                <Image
                  src="/miran-energy-logo.png"
                  alt="Miran Energy LTD"
                  width={300}
                  height={95}
                  priority
                  className="h-auto w-full max-w-[260px] object-contain"
                />
              </div>

              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                MCCS
              </div>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in with your authorized Miran Commercial Control System account.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email address
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-semibold text-blue-700 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3.5 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                >
                  {loading ? "Signing in..." : "Sign in to MCCS"}
                </button>
              </form>

              <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                Access is restricted to authorized Miran Energy personnel. Authentication is managed securely through Supabase Auth.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
