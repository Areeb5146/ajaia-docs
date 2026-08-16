import { NextResponse } from "next/server";
import { asJson, prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handler } from "@/lib/api";
import { EMPTY_DOC } from "@/lib/doc";

/** Create a blank document owned by the signed-in user. */
export const POST = handler(async () => {
  const user = await requireUser();

  const doc = await prisma.document.create({
    data: {
      title: "Untitled document",
      content: asJson(EMPTY_DOC),
      plainText: "",
      ownerId: user.id,
    },
    select: { id: true, title: true },
  });

  return NextResponse.json(doc, { status: 201 });
});
