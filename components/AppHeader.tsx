"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AppHeader({
  user,
  children,
}: {
  user: { name: string; email: string };
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/signin");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      {/* Wraps instead of squeezing: on a narrow screen a fixed-height row
          clipped the action buttons to unreadable stubs. */}
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <Link href="/documents" className="shrink-0 text-base font-semibold">
          Ajaia Docs
        </Link>
        <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
        <span
          className="hidden shrink-0 text-xs text-muted sm:block"
          title={user.email}
        >
          {user.name}
        </span>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
