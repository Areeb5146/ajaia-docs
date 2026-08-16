import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handler } from "@/lib/api";
import { assertCan, loadDocumentFor } from "@/lib/documents";

type Params = { params: Promise<{ id: string; userId: string }> };

/** Revoke access. Owner-only. Idempotent: revoking twice is not an error. */
export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id, userId } = await params;
  const { access } = await loadDocumentFor(id, user.id);
  assertCan(access, "canManageSharing");

  await prisma.share.deleteMany({ where: { documentId: id, userId } });
  return NextResponse.json({ ok: true });
});
