import { NextResponse } from "next/server";
import { z } from "zod";
import { asJson, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ApiError, handler } from "@/lib/api";
import { assertCan, loadDocumentFor } from "@/lib/documents";
import { docToPlainText, isValidDoc } from "@/lib/doc";

type Params = { params: Promise<{ id: string }> };

const UpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty.")
      .max(200, "Title is too long (200 characters max).")
      .optional(),
    // Validated structurally below rather than with a Zod recursive schema:
    // isValidDoc is the same allowlist the rest of the app trusts.
    content: z.unknown().optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: "Nothing to update.",
  });

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  const { access } = await loadDocumentFor(id, user.id);
  assertCan(access, "canWrite");

  const body = UpdateSchema.parse(await request.json());

  const data: {
    title?: string;
    content?: ReturnType<typeof asJson>;
    plainText?: string;
  } = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) {
    if (!isValidDoc(body.content)) {
      throw new ApiError("Document content is not in a supported format.", 422);
    }
    data.content = asJson(body.content);
    data.plainText = docToPlainText(body.content);
  }

  const updated = await prisma.document.update({
    where: { id },
    data,
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json(updated);
});

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  const { access } = await loadDocumentFor(id, user.id);
  assertCan(access, "canDelete");

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
