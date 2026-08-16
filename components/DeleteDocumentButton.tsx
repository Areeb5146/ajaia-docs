"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDocumentTitle } from "./DocumentTitleContext";

/**
 * Owner-only delete, with an inline two-step confirm.
 *
 * Inline rather than `window.confirm` so the confirmation is styled, testable,
 * and not suppressible by the browser. Deletion cascades to shares, so anyone it
 * was shared with loses access too — the copy says so rather than surprising the
 * owner.
 */
export function DeleteDocumentButton({
  documentId,
  sharedWithCount,
}: {
  documentId: string;
  sharedWithCount: number;
}) {
  const router = useRouter();
  // Live title rather than the server-rendered one, so a rename is reflected in
  // the confirmation instead of naming the document by its old name.
  const { title } = useDocumentTitle();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not delete this document.");
      }
      router.replace("/documents");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this document.");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
        >
          Delete
        </button>
        {error && (
          <span role="alert" className="text-xs text-red-600">
            {error}
          </span>
        )}
      </>
    );
  }

  return (
    <span className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1">
      <span className="text-xs text-red-800">
        Delete “{title.length > 28 ? `${title.slice(0, 25)}…` : title}”
        {sharedWithCount > 0 &&
          ` and remove access for ${sharedWithCount} ${sharedWithCount === 1 ? "person" : "people"}`}
        ?
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="rounded px-2 py-1 text-xs text-red-800 transition hover:bg-red-100 disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  );
}
