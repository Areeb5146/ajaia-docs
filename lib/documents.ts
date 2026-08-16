import { prisma } from "./prisma";
import { resolveAccess, type Access } from "./access";
import { ApiError } from "./api";

/**
 * Load a document and the caller's capabilities in one place.
 *
 * Every route that touches a document goes through this, so "not found" and
 * "no access" cannot diverge: both return 404 rather than leaking the existence
 * of documents the caller cannot see.
 */
export async function loadDocumentFor(documentId: string, viewerId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      shares: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!doc) throw new ApiError("Document not found.", 404);

  const access = resolveAccess({
    viewerId,
    ownerId: doc.ownerId,
    shares: doc.shares.map((s) => ({ userId: s.userId, role: s.role })),
  });

  if (!access.canRead) throw new ApiError("Document not found.", 404);

  return { doc, access };
}

export function assertCan(access: Access, capability: keyof Access) {
  if (!access[capability]) {
    throw new ApiError("You do not have permission to do that.", 403);
  }
}

/** Documents the user owns, plus documents shared with them. */
export async function listDocumentsFor(userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        plainText: true,
        updatedAt: true,
        _count: { select: { shares: true } },
      },
    }),
    prisma.share.findMany({
      where: { userId },
      orderBy: { document: { updatedAt: "desc" } },
      select: {
        role: true,
        document: {
          select: {
            id: true,
            title: true,
            plainText: true,
            updatedAt: true,
            owner: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ]);

  return { owned, shared };
}
