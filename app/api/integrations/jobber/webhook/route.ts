import { after, NextResponse } from "next/server";
import { getJobberClientSecret } from "@/lib/care-operations/jobber-oauth-config";
import {
  parseJobberWebhookPayload,
  processPendingJobberWebhooks,
  recordJobberWebhook,
} from "@/lib/integrations/jobber-webhook";
import { verifyJobberWebhookSignature } from "@/lib/integrations/webhook-signatures";

export const runtime = "nodejs";
// A visit snapshot traverses the complete history. Keep the response fast, but
// give its coalesced background worker the same budget as the repair endpoint.
export const maxDuration = 300;

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getJobberClientSecret();
  } catch {
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 503 },
    );
  }

  const rawPayload = await request.text();
  if (
    !verifyJobberWebhookSignature({
      payload: rawPayload,
      signature: request.headers.get("x-jobber-hmac-sha256"),
      secret,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = parseJobberWebhookPayload(rawPayload);
  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    // Never acknowledge a delivery before it is durable. A database failure
    // must remain retryable by Jobber rather than disappearing after a 202.
    await recordJobberWebhook({ rawPayload, event });
  } catch {
    console.error("[jobber-webhook] durable inbox unavailable");
    return NextResponse.json({ error: "Webhook could not be saved" }, { status: 503 });
  }
  after(() => processPendingJobberWebhooks());
  return NextResponse.json({ received: true }, { status: 202 });
}
