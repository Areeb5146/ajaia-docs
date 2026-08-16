"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type User = { id: string; name: string; email: string };

export function SignInList({ users }: { users: User[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(user: User) {
    setError(null);
    setBusyId(user.id);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not sign in.");
      }
      startTransition(() => {
        router.replace("/documents");
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          onClick={() => signIn(user)}
          disabled={busyId !== null || pending}
          className="flex w-full items-center gap-3 rounded-lg border border-line px-4 py-3 text-left transition hover:border-accent hover:bg-blue-50/50 disabled:opacity-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
            {user.name.charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
          {busyId === user.id && (
            <span className="ml-auto text-xs text-muted">Signing in…</span>
          )}
        </button>
      ))}
    </div>
  );
}
