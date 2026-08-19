"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_EMAIL = "prjoect.invoices@miranenergy.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
        setError(
          error.message === "Invalid login credentials"
            ? "The email or password is incorrect."
            : error.message
        );
        return;
      }

      if (!rememberMe) {
        // Session lifecycle is still handled securely by Supabase.
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please contact the MCCS administrator."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f]">
      <div className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(30,64,175,.30), transparent 32%), radial-gradient(circle at 85% 80%, rgba(249,115,22,.15), transparent 28%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-5 py-8 lg:px-10">
        <div className="grid w-full max-w-[1160px] overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_35px_100px_rgba(0,0,0,.38)] lg:grid-cols-[1.08fr_.92fr]">

          <section className="relative hidden min-h-[690px] overflow-hidden bg-[#f8fafc] p-12 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-orange-100/50 blur-3xl" />

            <div className="relative">
              <Image
                src="/miran-energy-logo.png"
                alt="Miran Energy LTD"
                width={420}
                height={130}
                priority
                className="h-auto w-full max-w-[390px] object-contain"
              />
            </div>

            <div className="relative max-w-[520px]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-blue-700" />
                Internal Commercial Platform
              </div>

              <h1 className="text-[42px] font-bold leading-[1.08] tracking-[-0.035em] text-slate-950">
                Commercial control with
                <span className="block text-blue-800">clarity and governance.</span>
              </h1>

              <p className="mt-6 max-w-[500px] text-[16px] leading-7 text-slate-600">
                A governed workspace for contracts, commitments, purchase orders,
                payment milestones, invoice assurance, approvals and payment control.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                {[
                  ["PO & Contract Control", "Commitments and revisions"],
                  ["Invoice Assurance", "Controlled verification"],
                  ["Payment Milestones", "Due-date visibility"],
                  ["Audit Trail", "Transparent accountability"],
                ].map(([title, sub]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
                    <div className="text-sm font-bold text-slate-900">{title}</div>
                    <div className="mt-1 text-xs text-slate-500">{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-center justify-between text-xs text-slate-500">
              <span>MCCS • Miran Commercial Control System</span>
              <span>Authorized access only</span>
            </div>
          </section>

          <section className="flex min-h-[690px] items-center bg-white p-7 sm:p-10 lg:p-14">
            <div className="mx-auto w-full max-w-[430px]">
              <div className="mb-8 lg:hidden">
                <Image
                  src="/miran-energy-logo.png"
                  alt="Miran Energy LTD"
                  width={310}
                  height={100}
                  priority
                  className="h-auto w-full max-w-[270px] object-contain"
                />
              </div>

              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue-800">
                MCCS
              </div>

              <h2 className="mt-5 text-[34px] font-bold tracking-[-0.03em] text-slate-950">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to your Miran Commercial Control System workspace.
              </p>

              <form className="mt-9 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label className="block text-sm font-bold text-slate-700">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-bold text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-12 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Keep me signed in on this device
                </label>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl bg-[#07111f] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                >
                  {loading ? "Signing in..." : "Sign in to MCCS"}
                </button>
              </form>

              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <p className="text-xs leading-5 text-slate-500">
                  Access is restricted to authorized Miran Energy personnel. Sign-in and recovery are handled through secure Supabase authentication.
                </p>
              </div>

              <p className="mt-7 text-center text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Miran Energy LTD • Internal
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
