import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import type { Prisma } from "./generated/prisma/client";

/**
 * Our document type is a recursive interface, which Prisma's structural
 * `InputJsonValue` cannot match even though the runtime value is plain JSON.
 * One narrow cast here beats scattering casts across every write site.
 */
export function asJson(value: object): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

// Prisma 7 connects through a driver adapter. `adapter-pg` speaks plain
// Postgres, so the same code works against Prisma Postgres, Neon, Supabase, or
// a local instance — only DATABASE_URL changes.
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next.js dev hot-reload re-evaluates modules; without the global cache we would
// leak a connection pool per reload and exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
