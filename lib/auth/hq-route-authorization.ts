import "server-only";

import { NextResponse } from "next/server";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";
import {
  HqAccessError,
  requireHqActor,
  type HqActor,
} from "@/lib/auth/hq-access";

export type HqApiAuthorization =
  | { actor: HqActor; response?: never }
  | { actor?: never; response: NextResponse };

export function hqAccessErrorResponse(error: unknown): NextResponse {
  const status = error instanceof HqAccessError ? error.status : 503;
  const message =
    status === 401
      ? "Authentication required"
      : status === 403
        ? "Forbidden"
        : "Headquarters access is unavailable";
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: HQ_AUTH_RESPONSE_HEADERS,
    },
  );
}

export async function authorizeHqApiRequest(
  actorRequirement: () => Promise<HqActor> = requireHqActor,
): Promise<HqApiAuthorization> {
  try {
    return { actor: await actorRequirement() };
  } catch (error) {
    return { response: hqAccessErrorResponse(error) };
  }
}
