import { NextResponse } from "next/server";
import { resolveAgreementPdfAccessUrl } from "@/lib/agreement/signed-agreement-storage";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MembershipAgreementRow {
  agreement_id: string | null;
}

interface SignedAgreementRow {
  id: string;
  agreement_pdf_url: string | null;
}

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function fail(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: PRIVATE_HEADERS },
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) return fail("Portal access token required.", 400);

  const access = await resolvePortalAccessByToken(token);
  if (!access) return fail("Unauthorized.", 401);

  const supabase = createPrivilegedServerSupabaseClient();
  const membershipResult = await supabase
    .from("memberships")
    .select("agreement_id")
    .eq("id", access.membershipId)
    .eq("property_id", access.propertyId)
    .maybeSingle();

  if (membershipResult.error || !membershipResult.data) {
    console.error("[portal-agreement] membership lookup failed", {
      membershipId: access.membershipId,
      propertyId: access.propertyId,
      reason: membershipResult.error?.message ?? "membership not found",
    });
    return fail("Signed agreement unavailable.", 404);
  }

  const membership = membershipResult.data as MembershipAgreementRow;
  let agreement: SignedAgreementRow | null = null;

  if (membership.agreement_id) {
    const linkedAgreement = await supabase
      .from("signed_agreements")
      .select("id, agreement_pdf_url")
      .eq("id", membership.agreement_id)
      .eq("membership_id", access.membershipId)
      .eq("property_id", access.propertyId)
      .eq("status", "complete")
      .maybeSingle();

    if (linkedAgreement.error) {
      console.error("[portal-agreement] linked agreement lookup failed", {
        membershipId: access.membershipId,
        agreementId: membership.agreement_id,
        reason: linkedAgreement.error.message,
      });
      return fail("Signed agreement unavailable.", 404);
    }

    agreement = linkedAgreement.data as SignedAgreementRow | null;
  } else {
    // Legacy memberships created before agreement_id was authoritative still
    // get their own latest completed agreement, constrained to this membership
    // and property. Never fall back to another customer's document.
    const legacyAgreement = await supabase
      .from("signed_agreements")
      .select("id, agreement_pdf_url")
      .eq("membership_id", access.membershipId)
      .eq("property_id", access.propertyId)
      .eq("status", "complete")
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyAgreement.error) {
      console.error("[portal-agreement] legacy agreement lookup failed", {
        membershipId: access.membershipId,
        propertyId: access.propertyId,
        reason: legacyAgreement.error.message,
      });
      return fail("Signed agreement unavailable.", 404);
    }

    agreement = legacyAgreement.data as SignedAgreementRow | null;
  }

  if (!agreement?.agreement_pdf_url) {
    return fail("Signed agreement unavailable.", 404);
  }

  const freshPdfUrl = await resolveAgreementPdfAccessUrl(
    agreement.agreement_pdf_url,
  );
  if (!freshPdfUrl) {
    return fail("Signed agreement file unavailable.", 404);
  }

  return NextResponse.redirect(freshPdfUrl, {
    status: 307,
    headers: PRIVATE_HEADERS,
  });
}
