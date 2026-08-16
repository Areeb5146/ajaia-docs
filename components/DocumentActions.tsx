"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE, SUPPORTED_EXTENSIONS } from "@/lib/import";

/** Create a blank document, or create one from an uploaded file. */
export function DocumentActions() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "new" | "upload">(null);
  const [error, setError] = useState<string | null>(null);

  async function createBlank() {
    setError(null);
    setBusy("new");
    try {
      const response = await fetch("/api/documents", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create document.");
      router.push(`/documents/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create document.");
      setBusy(null);
    }
  }

  async function upload(file: File) {
    setError(null);
    setBusy("upload");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body: data });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not import file.");
      router.push(`/documents/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import file.");
      setBusy(null);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={createBlank}
          disabled={busy !== null}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
        >
          {busy === "new" ? "Creating…" : "New document"}
        </button>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
          className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy === "upload" ? "Importing…" : "Upload a file"}
        </button>

        <span className="text-xs text-muted">
          Supported: {SUPPORTED_EXTENSIONS.join(", ")} · max 2 MB
        </span>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
