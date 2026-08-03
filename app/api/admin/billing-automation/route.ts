import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  attestMembershipBillingAuthorization,
  loadAutomaticBillingControlView,
  prepareFounderRetry,
  setMembershipAutomaticBilling,
} from "@/lib/billing/automatic-billing-control";
import { runAutomaticMembershipBilling } from "@/lib/billing/automatic-billing-executor";
import { requestStripeLiveWebhookVerification } from "@/lib/billing/stripe-live-webhook-verification";
import {
  updateAutomaticBillingSettings,
  type AutomaticBillingExecutionMode,
} from "@/lib/billing/automatic-billing-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  return authorizeAdminRequest(request.headers);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await loadAutomaticBillingControlView(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Automatic billing controls are unavailable",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PATCH(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  try {
    if (body?.action === "authorize_membership") {
      if (typeof body.membershipId !== "string") {
        return NextResponse.json(
          { error: "Membership is required" },
          { status: 400 },
        );
      }
      await attestMembershipBillingAuthorization({
        membershipId: body.membershipId,
        actor: "hq_founder_reviewed_signed_pdf",
      });
    } else if (body?.action === "membership") {
      if (
        typeof body.membershipId !== "string" ||
        typeof body.enabled !== "boolean"
      ) {
        return NextResponse.json(
          { error: "Membership and enabled state are required" },
          { status: 400 },
        );
      }
      await setMembershipAutomaticBilling({
        membershipId: body.membershipId,
        enabled: body.enabled,
        actor: "hq_founder",
        reason: typeof body.reason === "string" ? body.reason : undefined,
      });
    } else {
      const mode = body?.executionMode;
      if (
        typeof body?.enabled !== "boolean" ||
        (mode !== undefined &&
          !["shadow", "approval", "automatic"].includes(String(mode)))
      ) {
        return NextResponse.json(
          { error: "A valid automatic billing setting is required" },
          { status: 400 },
        );
      }
      if (body.enabled === true) {
        const readiness = await loadAutomaticBillingControlView();
        if (
          mode !== "automatic" ||
          !readiness.stripeLive ||
          !readiness.stripeWebhookConfigured ||
          !readiness.stripeWebhookVerified
        ) {
          return NextResponse.json(
            {
              error:
                "Automatic billing requires live Stripe keys and a verified no-charge live webhook delivery before it can be armed.",
            },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          );
        }
      }
      await updateAutomaticBillingSettings({
        enabled: body.enabled,
        actor: "hq_founder",
        executionMode: mode as AutomaticBillingExecutionMode | undefined,
        maxChargeCents:
          typeof body.maxChargeCents === "number"
            ? body.maxChargeCents
            : undefined,
      });
    }
    return NextResponse.json(await loadAutomaticBillingControlView(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    billingOrderId?: unknown;
  } | null;
  try {
    if (body?.action === "verify_webhook") {
      const verification = await requestStripeLiveWebhookVerification();
      return NextResponse.json(
        {
          verification,
          message:
            "A no-charge live Stripe verification was requested. The signed webhook normally arrives within a few seconds.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body?.action === "retry") {
      if (typeof body.billingOrderId !== "string") {
        return NextResponse.json(
          { error: "Billing order is required" },
          { status: 400 },
        );
      }
      const readiness = await loadAutomaticBillingControlView();
      if (
        !readiness.settings.enabled ||
        readiness.settings.executionMode !== "automatic" ||
        !readiness.stripeLive ||
        !readiness.stripeWebhookConfigured ||
        !readiness.stripeWebhookVerified
      ) {
        return NextResponse.json(
          {
            error:
              "Billing must be armed with verified live Stripe webhooks before an exact failed charge can be retried.",
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      await prepareFounderRetry({
        billingOrderId: body.billingOrderId,
        actor: "hq_founder_retry",
      });
      const run = await runAutomaticMembershipBilling({
        triggerSource: "founder_retry",
        actor: "hq_founder_retry",
        orderId: body.billingOrderId,
      });
      return NextResponse.json({ run }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (body?.action !== "preview") {
      return NextResponse.json(
        {
          error:
            "Choose live webhook verification, a read-only billing preview, or an exact failed retry.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const run = await runAutomaticMembershipBilling({
      triggerSource: "founder_manual",
      actor: "hq_founder_manual_run",
    });
    return NextResponse.json({ run }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing run failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
