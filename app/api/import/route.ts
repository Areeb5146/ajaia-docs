import { NextResponse } from "next/server";
import { asJson, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ApiError, handler } from "@/lib/api";
import { MAX_UPLOAD_BYTES, parseUpload } from "@/lib/import";
import { docToPlainText } from "@/lib/doc";

// The parser (mammoth for .docx) needs Node APIs, not the edge runtime.
export const runtime = "nodejs";

/** Upload a .txt/.md/.docx file and turn it into a new editable document. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();

  const form = await request.formData().catch(() => {
    throw new ApiError("Expected a file upload.", 400);
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("No file was uploaded.", 400);

  // Checked before buffering so an oversized upload is rejected cheaply; the
  // parser re-checks the real byte length in case the header lied.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      `File is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
      413,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { doc, title } = await parseUpload(file.name, bytes);

  const created = await prisma.document.create({
    data: {
      title,
      content: asJson(doc),
      plainText: docToPlainText(doc),
      ownerId: user.id,
    },
    select: { id: true, title: true },
  });

  return NextResponse.json(created, { status: 201 });
});
