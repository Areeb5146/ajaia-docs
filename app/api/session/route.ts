import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/session";
import { ApiError, handler } from "@/lib/api";

const SignInSchema = z.object({
  userId: z.string().min(1, "Pick an account to continue."),
});

/** Mocked sign-in: sets a cookie naming a seeded user. No password by design. */
export const POST = handler(async (request: Request) => {
  const { userId } = SignInSchema.parse(await request.json());

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError("Unknown account.", 404);

  const response = NextResponse.json({ id: user.id, name: user.name });
  response.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
});

export const DELETE = handler(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
