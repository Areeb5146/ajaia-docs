import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { SignInList } from "@/components/SignInList";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/documents");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Ajaia Docs</h1>
        <p className="mt-2 text-sm text-muted">
          Demo sign-in. Pick a seeded account — there are no passwords, and the
          session is a cookie holding the account id.
        </p>

        {users.length === 0 ? (
          <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            No seeded accounts found. Run{" "}
            <code className="font-mono">npx prisma db seed</code> and reload.
          </p>
        ) : (
          <SignInList users={users} />
        )}

        <p className="mt-6 text-xs text-muted">
          Ava owns the seeded documents. Ben has editor access to one and viewer
          access to the other — sign in as each to see the difference.
        </p>
      </div>
    </main>
  );
}
