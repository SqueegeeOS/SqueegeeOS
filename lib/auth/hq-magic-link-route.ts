import { NextResponse } from "next/server";
import {
  classifyHqMagicLinkDeliveryError,
  isActiveHqMagicLinkRecipient,
  isHqEdgeAbuseControlVerified,
  normalizeHqLoginEmail,
  readHqRequestNetwork,
  recordHqMagicLinkDelivery,
  reserveHqMagicLinkRequest,
} from "@/lib/auth/hq-magic-link-limiter";
import { readHqJsonBody } from "@/lib/auth/hq-request-body";
import {
  resolveHqAuthOrigin,
  resolveSafeHqNextPath,
} from "@/lib/auth/hq-navigation";
import { createCookieAwareSupabaseServerClient } from "@/lib/auth/supabase-server";
import { HQ_AUTH_RESPONSE_HEADERS } from "@/lib/auth/hq-response-headers";

const NEUTRAL_BODY = {
  ok: true,
  message:
    "If access is available for that address, a secure sign-in link will arrive shortly.",
};

function neutralResponse() {
  return NextResponse.json(NEUTRAL_BODY, {
    status: 202,
    headers: HQ_AUTH_RESPONSE_HEADERS,
  });
}

interface HqMagicLinkRouteDependencies {
  reserve?: typeof reserveHqMagicLinkRequest;
  isRecipientApproved?: typeof isActiveHqMagicLinkRecipient;
  recordDelivery?: typeof recordHqMagicLinkDelivery;
  createClient?: typeof createCookieAwareSupabaseServerClient;
  edgeControlVerified?: boolean;
  vercelDeployment?: boolean;
}

export async function handleHqMagicLinkRequest(
  request: Request,
  dependencies: HqMagicLinkRouteDependencies = {},
) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return neutralResponse();

  const body = await readHqJsonBody(request);
  if (!body) return neutralResponse();

  const email = normalizeHqLoginEmail(body.email);
  if (!email) return neutralResponse();
  const nextPath = resolveSafeHqNextPath(
    typeof body.next === "string" ? body.next : null,
  );
  const network = readHqRequestNetwork(
    request,
    dependencies.vercelDeployment ?? process.env.VERCEL === "1",
  );
  const edgeControlVerified =
    dependencies.edgeControlVerified ?? isHqEdgeAbuseControlVerified();
  if (!network || !edgeControlVerified) return neutralResponse();

  let requestId: string;
  try {
    const reserve = dependencies.reserve ?? reserveHqMagicLinkRequest;
    const reservation = await reserve(email, network);
    requestId = reservation.requestId;
    if (!reservation.allowed) return neutralResponse();
  } catch {
    console.error("[hq-auth] magic-link request failed closed");
    return neutralResponse();
  }

  try {
    const isRecipientApproved =
      dependencies.isRecipientApproved ?? isActiveHqMagicLinkRecipient;
    if (!(await isRecipientApproved(email))) return neutralResponse();
  } catch {
    console.error("[hq-auth] recipient lookup failed closed");
    return neutralResponse();
  }

  let outcome: Parameters<typeof recordHqMagicLinkDelivery>[1];
  try {
    const callback = new URL(
      "/auth/hq/callback",
      resolveHqAuthOrigin(request.url),
    );
    callback.searchParams.set("next", nextPath);
    const createClient =
      dependencies.createClient ?? createCookieAwareSupabaseServerClient;
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callback.toString(),
      },
    });
    outcome = classifyHqMagicLinkDeliveryError(error);
  } catch {
    outcome = "provider_unknown";
  }

  const recordDelivery =
    dependencies.recordDelivery ?? recordHqMagicLinkDelivery;
  await recordDelivery(requestId, outcome).catch(() => {
    console.error("[hq-auth] magic-link delivery audit failed");
  });

  return neutralResponse();
}
