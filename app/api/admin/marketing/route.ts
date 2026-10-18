import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { loadCustomerAftercareSnapshot } from "@/lib/aftercare/customer-aftercare-server";
import { loadReviewRequestAutomationStatus } from "@/lib/aftercare/review-request-automation-server";
import { resolveGoogleReviewRequestUrl } from "@/lib/reviews/review-request-url-server";
import { PUBLIC_SERVICES } from "@/lib/marketing/public-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Read-only editorial context. No customer identities, addresses, photos, or tokens leave the source workflow. */
export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const [snapshot, automation, reviewLink] = await Promise.allSettled([
    loadCustomerAftercareSnapshot(),
    loadReviewRequestAutomationStatus(),
    resolveGoogleReviewRequestUrl(),
  ]);
  return NextResponse.json({
    visitsAvailable: snapshot.status === "fulfilled",
    visits: snapshot.status === "fulfilled" ? snapshot.value.tasks
      .filter((task) => task.type === "review_opportunity")
      .map((task) => ({
        id: task.appointmentId,
        serviceLabel: PUBLIC_SERVICES.filter((service) => task.serviceLabel.toLowerCase().includes(service.slug.split("-")[0])).map((service) => service.name).join(" + ") || "Completed service",
        completedAt: task.completedAt,
      })) : [],
    reviewAutomation: automation.status === "fulfilled" ? automation.value : null,
    reviewUrl: reviewLink.status === "fulfilled" ? reviewLink.value : null,
  }, { headers });
}
