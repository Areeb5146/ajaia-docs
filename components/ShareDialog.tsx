"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ShareRole } from "@/lib/access";

type ShareEntry = {
  role: ShareRole;
  user: { id: string; name: string; email: string };
};

export function ShareDialog({
  documentId,
  owner,
  shares,
  canManage,
}: {
  documentId: string;
  owner: { name: string; email: string };
  shares: ShareEntry[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not share.");
      setNotice(
        `${payload.user.name} can now ${payload.role === "EDITOR" ? "edit" : "view"} this document.`,
      );
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not share.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/documents/${documentId}/shares/${userId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Could not remove access.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-50"
      >
        {canManage ? "Share" : "Who has access"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sharing"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">Share this document</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-muted hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            {canManage && (
              <form onSubmit={grant} className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="share-email"
                    className="block text-xs font-medium text-muted"
                  >
                    Email of a seeded account
                  </label>
                  <input
                    id="share-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ben@ajaia.test"
                    className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor="share-role"
                      className="block text-xs font-medium text-muted"
                    >
                      Access level
                    </label>
                    <select
                      id="share-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as ShareRole)}
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                    >
                      <option value="VIEWER">Can view</option>
                      <option value="EDITOR">Can edit</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Share"}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
                {notice}
              </p>
            )}

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
              People with access
            </h3>
            <ul className="mt-2 divide-y divide-line rounded-md border border-line">
              <li className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {owner.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {owner.email}
                  </span>
                </span>
                <span className="text-xs text-muted">Owner</span>
              </li>
              {shares.map((share) => (
                <li key={share.user.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {share.user.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {share.user.email}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {share.role === "EDITOR" ? "Can edit" : "Can view"}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => revoke(share.user.id)}
                      disabled={busy}
                      className="rounded px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {shares.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                Not shared with anyone yet.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
