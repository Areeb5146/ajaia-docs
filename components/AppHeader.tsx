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
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/documents" className="text-base font-semibold">
          Ajaia Docs
        </Link>
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {children}
        </div>
        <span
          className="hidden text-xs text-muted sm:block"
          title={user.email}
        >
          {user.name}
        </span>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
