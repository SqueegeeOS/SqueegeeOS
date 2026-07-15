import "server-only";

import { createHash } from "node:crypto";
import { computePresentationAuthoritySha256 } from "@/lib/presentations/authority-hash";
import { isAuthoritativePresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import type { PresentationData } from "@/lib/presentations/types";
import { slugifyPresentation } from "@/lib/presentations/calculations";

export interface ExistingMembershipLinkage {
  id: string;
  presentation_id: string | null;
  status: string;
  agreement_id: string | null;
}

export interface PropertyAddressIdentity {
  address: string;
  city: string;
  state: string;
  zip: string;
}

function normalizeAddressPart(value: string): string {
  return value
    .replace(/[ \t\n\r\f\v]+/g, " ")
    .trim()
    .toLowerCase();
}

/** Mirrors migration 036's generated properties.authority_address_key. */
export function propertyAuthorityAddressKey(
  value: PropertyAddressIdentity,
): string {
  return [value.address, value.city, value.state, value.zip]
    .map(normalizeAddressPart)
    .join("|");
}

export function signingEvidenceSha256(signatureDataUrl: string): string {
  const separator = signatureDataUrl.indexOf(",");
  if (separator < 0) throw new Error("Signature evidence is invalid");
  const bytes = Buffer.from(signatureDataUrl.slice(separator + 1), "base64");
  return createHash("sha256").update(bytes).digest("hex");
}

export function signingEvidenceBytesSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function presentationSourceSlug(
  label: string,
  presentationId: string,
  fallback: string,
): string {
  const base = slugifyPresentation(label) || fallback;
  const sourceSuffix = presentationId.replaceAll("-", "").slice(0, 12);
  return `${base.slice(0, 35)}-${sourceSuffix}`;
}

export function membershipLinkageConflictReason(
  membership: ExistingMembershipLinkage,
  presentationId: string,
): string | null {
  if (membership.presentation_id !== presentationId) {
    return "property already belongs to a different presentation membership";
  }
  if (["active", "paused", "cancelled"].includes(membership.status)) {
    return `existing ${membership.status} membership cannot be rewritten by signing`;
  }
  if (membership.agreement_id) {
    return "membership already references different agreement evidence";
  }
  return null;
}

export function verifiedPresentationAuthority(
  presentation: PresentationData,
): string | null {
  if (
    !isAuthoritativePresentationQuoteSnapshot(presentation.quoteSnapshot) ||
    !presentation.authoritySha256 ||
    presentation.quoteSnapshot.sqft !== presentation.homeSqft
  ) {
    return null;
  }
  const computed = computePresentationAuthoritySha256({
    clientName: presentation.clientName,
    clientAddress: presentation.clientAddress,
    clientEmail: presentation.clientEmail,
    homeSqft: presentation.homeSqft,
    tier: presentation.tier,
    twoStory: presentation.twoStory,
    includeScreens: presentation.includeScreens,
    quoteSnapshot: presentation.quoteSnapshot,
  });
  return computed === presentation.authoritySha256 ? computed : null;
}
