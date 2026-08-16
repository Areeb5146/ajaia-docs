import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ApiError, handler } from "@/lib/api";
import { assertCan, loadDocumentFor } from "@/lib/documents";

type Params = { params: Promise<{ id: string }> };

const ShareSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["VIEWER", "EDITOR"]).default("VIEWER"),
});

/** Grant access by email. Owner-only. */
export const POST = handler(async (request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  const { doc, access } = await loadDocumentFor(id, user.id);
  assertCan(access, "canManageSharing");

  const { email, role } = ShareSchema.parse(await request.json());

  const recipient = await prisma.user.findUnique({ where: { email } });
  if (!recipient) {
    // Mocked auth means there is no invite flow; say so plainly instead of
    // failing silently.
    throw new ApiError(
      "No account with that email. This demo uses seeded accounts — see the sign-in page for valid addresses.",
      404,
    );
  }
  if (recipient.id === doc.ownerId) {
    throw new ApiError("That person already owns this document.", 409);
  }

  // Upsert so re-sharing changes the role instead of erroring on the unique key.
  const share = await prisma.share.upsert({
    where: { documentId_userId: { documentId: id, userId: recipient.id } },
    update: { role },
    create: { documentId: id, userId: recipient.id, role },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(share, { status: 201 });
});
