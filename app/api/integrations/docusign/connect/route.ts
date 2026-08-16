import { NextResponse } from "next/server";
import {
  parseDocuSignEnvelopeEvent,
  resolveDocuSignConfig,
  verifyDocuSignConnectHmac,
} from "@/lib/integrations/docusign";
import { processDocuSignEnrollmentConnect } from "@/lib/enrollment/process-docusign-connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = resolveDocuSignConfig().connectHmacSecret;
  if (!secret) {
    return NextResponse.json(
      { error: "DocuSign Connect is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const rawBody = await request.text();
  const verified = verifyDocuSignConnectHmac({
    rawBody,
    secret,
    signatures: [1, 2, 3, 4].map((index) =>
      request.headers.get(`x-docusign-signature-${index}`),
    ),
  });
  if (!verified) {
    return NextResponse.json(
      { error: "Invalid DocuSign signature" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const event = parseDocuSignEnvelopeEvent(rawBody);
  if (!event) {
    return NextResponse.json(
      { error: "Invalid DocuSign event" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await processDocuSignEnrollmentConnect({ event, rawBody });
    return NextResponse.json(
      { received: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[docusign-connect] processing failed", {
      envelopeId: event.envelopeId,
      eventType: event.eventType,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "DocuSign event processing failed and will be retried" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
