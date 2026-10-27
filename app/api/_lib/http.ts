import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import type { ApiError, FieldErrors } from "@/lib/types";

export function errorResponse(status: number, error: string, fieldErrors?: FieldErrors) {
  const body: ApiError = fieldErrors ? { error, fieldErrors } : { error };
  return NextResponse.json(body, { status });
}

export function dbUnavailable(err: unknown) {
  // Detail stays on the server. Never put it in the response.
  console.error("[api] database error:", err);
  return errorResponse(503, "Could not reach the database. Try again in a moment.");
}

/** Strict 24-hex check. ObjectId.isValid also accepts any 12 character string. */
export function parseObjectId(id: string): ObjectId | null {
  return /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

export const VALIDATION_MESSAGE = "Fix the highlighted fields and try again";
