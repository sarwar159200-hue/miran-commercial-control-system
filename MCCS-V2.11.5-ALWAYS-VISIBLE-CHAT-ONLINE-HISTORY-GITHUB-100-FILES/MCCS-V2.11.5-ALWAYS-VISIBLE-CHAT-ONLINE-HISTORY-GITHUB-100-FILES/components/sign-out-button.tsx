"use client";

import { Camera, LogOut, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}

export function ProfileAvatarUploader({
  avatarUrl,
  displayName,
  initials,
}: {
  avatarUrl?: string | null;
  displayName: string;
  initials: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentAvatar, setCurrentAvatar] = useState(avatarUrl || "");

  function chooseFile(next: File | null) {
    setError("");
    setFile(next);
    if (!next) {
      setPreview(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Please choose a JPG, PNG, or WEBP image.");
      setFile(null);
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("Profile picture must be 5 MB or smaller.");
      setFile(null);
      return;
    }
    setPreview(URL.createObjectURL(next));
  }

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("avatar", file);
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to upload profile picture.");
      setCurrentAvatar(String(payload.avatar_url || ""));
      setPreview(null);
      setFile(null);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload profile picture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-extrabold text-slate-600 shadow-sm transition hover:ring-2 hover:ring-blue-200"
        title="Change profile picture"
        aria-label="Change profile picture"
      >
        {currentAvatar ? (
          <img src={currentAvatar} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-slate-950/45 text-white group-hover:flex">
          <Camera className="h-4 w-4" />
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[310px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">Profile picture</div>
              <div className="mt-1 text-xs text-slate-500">Upload your own photo. JPG, PNG or WEBP, max 5 MB.</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-extrabold text-slate-600">
              {(preview || currentAvatar) ? <img src={preview || currentAvatar} alt="Profile preview" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{displayName}</div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Camera className="h-4 w-4" /> Choose picture
              </button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => chooseFile(e.target.files?.[0] || null)}
          />

          {file ? <div className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{file.name}</div> : null}
          {error ? <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div> : null}

          <button
            type="button"
            disabled={!file || busy}
            onClick={upload}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#07111f] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-600"
          >
            <Upload className="h-4 w-4" />
            {busy ? "Uploading..." : "Save profile picture"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
