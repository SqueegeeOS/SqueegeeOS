import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import {
  exchangeJobberAuthorizationCode,
  fetchJobberAccountIdentity,
} from "@/lib/care-operations/jobber-api";
import { saveJobberConnection } from "@/lib/care-operations/jobber-connection-store";
import { resolveJobberOAuthRedirectUri } from "@/lib/care-operations/jobber-oauth-config";
import { consumeJobberOAuthState } from "@/lib/care-operations/jobber-oauth-state";
import { ROUTES } from "@/lib/navigation/config";

export const runtime = "nodejs";

function resultRedirect(request: Request, status: "connected" | "error", reason?: string) {
  const url = new URL(ROUTES.hqProductionHealth, request.url);
  url.searchParams.set("jobber", status);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

function isValidAuthorizationCode(code: string | null): code is string {
  return Boolean(
    code &&
      code.length <= 2048 &&
      !/[\u0000-\u0020\u007f]/.test(code),
  );
}

export async function GET(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const oauthError = url.searchParams.get("error");
  if (!(await consumeJobberOAuthState(state, authorization.actor.id))) {
    return resultRedirect(request, "error", "invalid_state");
  }
  if (oauthError) return resultRedirect(request, "error", "authorization_denied");
  if (!isValidAuthorizationCode(code)) {
    return resultRedirect(request, "error", "missing_code");
  }

  try {
    const redirectUri = resolveJobberOAuthRedirectUri(request);
    const tokens = await exchangeJobberAuthorizationCode(code, redirectUri);
    const account = await fetchJobberAccountIdentity(tokens.accessToken);
    await saveJobberConnection({
      account,
      tokens,
      actorId: authorization.actor.id,
    });
    return resultRedirect(request, "connected");
  } catch (error) {
    console.error(
      "[jobber-oauth] callback failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return resultRedirect(request, "error", "connection_failed");
  }
}
