import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listDocumentsFor } from "@/lib/documents";
import { AppHeader } from "@/components/AppHeader";
import { DocumentActions } from "@/components/DocumentActions";

export const dynamic = "force-dynamic";

function preview(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Empty document";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

function when(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { owned, shared } = await listDocumentsFor(user.id);

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <DocumentActions />

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            My documents ({owned.length})
          </h2>
          {owned.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-line p-6 text-sm text-muted">
              No documents yet. Create one or upload a file to get started.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {owned.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="block h-full rounded-lg border border-line bg-surface p-4 transition hover:border-accent hover:shadow-sm"
                  >
                    <span className="block truncate font-medium">{doc.title}</span>
                    <span className="mt-1 block text-xs text-muted line-clamp-2">
                      {preview(doc.plainText)}
                    </span>
                    <span className="mt-3 flex items-center gap-2 text-xs text-muted">
                      <span>Edited {when(doc.updatedAt)}</span>
                      {doc._count.shares > 0 && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-accent">
                          Shared with {doc._count.shares}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Shared with me ({shared.length})
          </h2>
          {shared.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-line p-6 text-sm text-muted">
              Nothing shared with you yet.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {shared.map(({ role, document: doc }) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="block h-full rounded-lg border border-line bg-surface p-4 transition hover:border-accent hover:shadow-sm"
                  >
                    <span className="block truncate font-medium">{doc.title}</span>
                    <span className="mt-1 block text-xs text-muted line-clamp-2">
                      {preview(doc.plainText)}
                    </span>
                    <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                        {role === "EDITOR" ? "Can edit" : "View only"}
                      </span>
                      <span className="truncate">Owner: {doc.owner.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
