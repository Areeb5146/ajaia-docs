import { NextResponse } from "next/server";
import { asJson, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ApiError, handler } from "@/lib/api";
import { assertCan, loadDocumentFor } from "@/lib/documents";
import { MAX_UPLOAD_BYTES, parseUpload } from "@/lib/import";
import { docToPlainText, isValidDoc, type DocNode } from "@/lib/doc";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Import a file's content into an existing draft, appended at the end.
 *
 * Append rather than replace: an import that silently destroys existing work is
 * the wrong default, and undo across a save boundary is out of scope.
 */
export const POST = handler(async (request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  const { doc: existing, access } = await loadDocumentFor(id, user.id);
  assertCan(access, "canWrite");

  const form = await request.formData().catch(() => {
    throw new ApiError("Expected a file upload.", 400);
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("No file was uploaded.", 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      `File is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
      413,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { doc: imported } = await parseUpload(file.name, bytes);

  const currentContent = isValidDoc(existing.content)
    ? (existing.content.content as DocNode[])
    : [];
  // Drop a single trailing empty paragraph so imports do not accumulate blank
  // lines every time.
  const trimmed =
    currentContent.length === 1 &&
    currentContent[0]?.type === "paragraph" &&
    !currentContent[0]?.content
      ? []
      : currentContent;

  const merged = {
    type: "doc" as const,
    content: [...trimmed, ...imported.content],
  };

  const updated = await prisma.document.update({
    where: { id },
    data: { content: asJson(merged), plainText: docToPlainText(merged) },
    select: { id: true, updatedAt: true },
  });

  return NextResponse.json({ ...updated, content: merged });
});
