"use client";

import { useState } from "react";

export function StorageControl() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function test() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/onedrive/status", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.connected) {
        throw new Error(data.error || `Missing: ${(data.missing || []).join(", ")}`);
      }

      const quota = data.drive?.quota;
      const quotaText =
        quota?.total && quota?.used
          ? ` • ${(quota.used / 1024 / 1024 / 1024).toFixed(1)} GB used of ${(quota.total / 1024 / 1024 / 1024).toFixed(1)} GB`
          : "";

      setMessage(
        `Connected to ${data.drive?.name || "Microsoft Drive"} (${data.drive?.driveType || "drive"})${quotaText}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection test failed.");
    } finally {
      setLoading(false);
    }
  }

  async function initialize() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/onedrive/initialize", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Folder initialization failed.");
      }

      setMessage("MCCS Microsoft folder structure initialized successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Folder initialization failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button
        onClick={test}
        disabled={loading}
        className="rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-blue-600"
      >
        Test Connection
      </button>
      <button
        onClick={initialize}
        disabled={loading}
        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
      >
        Initialize MCCS Folders
      </button>

      {message ? (
        <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
