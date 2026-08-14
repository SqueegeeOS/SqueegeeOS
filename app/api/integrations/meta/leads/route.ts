import { after, NextResponse } from "next/server";
import {
  ingestMetaLead,
  resolveMetaLeadAdsConfiguration,
  runMetaLeadPostSaveAutomation,
} from "@/lib/integrations/meta-lead-ingestion";
import { parseMetaLeadWebhookPayload } from "@/lib/integrations/meta-lead-ads";
import { recordCurrentMetaWebhookProof } from "@/lib/integrations/meta-webhook-readiness";
import { verifyMetaWebhookSignature } from "@/lib/integrations/webhook-signatures";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!verifyToken) return new Response("Webhook is not configured", { status: 503 });
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || token !== verifyToken || !challenge) {
    return new Response("Verification failed", { status: 403 });
  }
  try {
    await recordCurrentMetaWebhookProof({
      kind: "callback_challenge",
      payload: challenge,
    });
  } catch (error) {
    console.error("[meta-leads] callback proof failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Verification storage unavailable", { status: 503 });
  }
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const config = resolveMetaLeadAdsConfiguration();
  if (!config) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  const rawPayload = await request.text();
  if (!verifyMetaWebhookSignature({
    payload: rawPayload,
    signature: request.headers.get("x-hub-signature-256"),
    secret: config.appSecret,
  })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const references = parseMetaLeadWebhookPayload(rawPayload);
  if (!references) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    await recordCurrentMetaWebhookProof({
      kind: "signed_event",
      payload: rawPayload,
    });
  } catch (error) {
    console.error("[meta-leads] signed webhook proof failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Webhook verification storage unavailable" },
      { status: 503 },
    );
  }
  if (references.length === 0) {
    return NextResponse.json({ received: true, leads: 0 }, { status: 202 });
  }
  try {
    const ingested = await Promise.all(
      references.map((reference) => ingestMetaLead({ reference, config })),
    );
    after(async () => {
      await Promise.all(
        ingested.map(({ record, duplicate }) =>
          runMetaLeadPostSaveAutomation(record, {
            notifyFounderByEmail: !duplicate,
          }),
        ),
      );
    });
    return NextResponse.json({
      received: true,
      leads: ingested.length,
      duplicates: ingested.filter((lead) => lead.duplicate).length,
    }, { status: 202 });
  } catch (error) {
    console.error("[meta-leads] ingestion failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Lead ingestion failed and should be retried" },
      { status: 502 },
    );
  }
}
