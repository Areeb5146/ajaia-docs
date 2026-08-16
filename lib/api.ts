import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ImportError } from "./import";
import { UnauthorizedError } from "./session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Single translation point from thrown errors to HTTP responses, so routes can
 * `throw` domain errors and stay linear. Unknown errors are logged server-side
 * and reported generically — we never echo an internal message to the client.
 */
export function toErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ImportError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid request." },
      { status: 422 },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Wrap a route handler so every thrown error maps to a consistent response. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>,
) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
