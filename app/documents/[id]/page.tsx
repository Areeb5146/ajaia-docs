import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadDocumentFor } from "@/lib/documents";
import { ApiError } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { DocumentEditor } from "@/components/DocumentEditor";
import { ShareDialog } from "@/components/ShareDialog";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { DocumentTitleProvider } from "@/components/DocumentTitleContext";
import { EMPTY_DOC, isValidDoc } from "@/lib/doc";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;

  let loaded;
  try {
    loaded = await loadDocumentFor(id, user.id);
  } catch (error) {
    // loadDocumentFor deliberately reports "no access" as 404 so document
    // existence does not leak.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { doc, access } = loaded;
  // Guard against content written before a schema change; render an empty doc
  // rather than crashing the editor.
  const content = isValidDoc(doc.content) ? doc.content : EMPTY_DOC;

  return (
    // The provider wraps both the header and the editor so the document title
    // has exactly one owner on the client.
    <DocumentTitleProvider initialTitle={doc.title}>
      <AppHeader user={user}>
        <Link
          href="/documents"
          className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-neutral-100"
        >
          ← All documents
        </Link>
        <span className="hidden truncate text-xs text-muted sm:block">
          {access.level === "owner"
            ? "You own this"
            : `Shared by ${doc.owner.name} · ${access.canWrite ? "can edit" : "view only"}`}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <ShareDialog
            documentId={doc.id}
            owner={{ name: doc.owner.name, email: doc.owner.email }}
            shares={doc.shares.map((s) => ({ role: s.role, user: s.user }))}
            canManage={access.canManageSharing}
          />
          {access.canDelete && (
            <DeleteDocumentButton
              documentId={doc.id}
              sharedWithCount={doc.shares.length}
            />
          )}
        </span>
      </AppHeader>

      <main className="flex-1">
        <DocumentEditor
          documentId={doc.id}
          initialContent={content}
          access={access}
        />
      </main>
    </DocumentTitleProvider>
  );
}
