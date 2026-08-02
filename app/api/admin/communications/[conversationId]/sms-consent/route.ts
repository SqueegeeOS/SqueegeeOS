import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  HqSmsConsentError,
  recordHqSmsConsentDecision,
  validateHqSmsConsentInput,
} from "@/lib/communications/hq-sms-consent";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { isServiceRoleConfigured } from "@/lib/persistence/supabase/client";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  if (!isCloudPersistenceConnected() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Customer communications storage is not configured." },
      { status: 503 },
    );
  }

  const { conversationId } = await context.params;
  if (!conversationId.trim() || conversationId.length > 128) {
    return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
  }
  const payload = (await request.json().catch(() => null)) as {
    action?: unknown;
    phone?: unknown;
    evidenceNote?: unknown;
    attested?: unknown;
  } | null;

  try {
    const decision = validateHqSmsConsentInput({
      action: payload?.action,
      phone: payload?.phone,
      evidenceNote: payload?.evidenceNote,
      attested: payload?.attested,
      idempotencyKey: request.headers.get("idempotency-key"),
    });
    const result = await recordHqSmsConsentDecision({
      conversationId: conversationId.trim(),
      decision,
      actor: "hq_admin",
      sourcePath: new URL(request.url).pathname,
      requestIp:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent")?.slice(0, 1_000) || null,
    });
    return NextResponse.json(
      { consent: result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof HqSmsConsentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    console.error("[communications] SMS consent update failed", {
      conversationId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Text consent could not be recorded." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
