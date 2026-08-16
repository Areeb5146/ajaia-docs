import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "ajaia_uid";

/**
 * Mocked auth: the session cookie holds a seeded user id, nothing is signed or
 * verified. This is a deliberate scope cut — the assignment allows seeded
 * accounts, and real auth would have consumed budget better spent on the editor
 * and sharing model. See docs/ARCHITECTURE.md for what production would need.
 */
export async function getCurrentUser() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return prisma.user.findUnique({
    select: { id: true, name: true, email: true },
    where: { id },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}
