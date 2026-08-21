import "server-only";

import { isMembershipActive } from "@/lib/membership/membership-status";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";
import { reconcilePairedCustomerPortalVisit } from "./jobber-portal-appointments";

const AUTO_LINK_ACTOR = "atlas_exact_customer_matcher";
const AUTO_LINK_REASON =
  "Unique exact property address plus exact non-conflicting customer contact; one property in each system";

type LinkState = "active" | "revoked";

export interface StrictJobberClient {
  external_client_id: string;
  email: string | null;
  phone: string | null;
  is_archived: boolean;
  properties: Array<{
    id: string;
    address: Record<string, string | null> | null;
  }> | null;
  property_count: number;
  properties_complete: boolean;
}

export interface StrictHomeowner {
  id: string;
  email: string | null;
  phone: string | null;
}

export interface StrictProperty {
  id: string;
  homeowner_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface StrictMembership {
  id: string;
  homeowner_id: string;
  property_id: string;
  status: string;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id: string | null;
  stripe_customer_id: string | null;
  payment_rail?: "stripe_card" | "manual_cash_check";
  manual_payment_approved_at?: string | null;
  manual_payment_approved_by?: string | null;
  agreement_id: string | null;
  sales_tier: string | null;
  visit_price: number | null;
}

export interface StrictCustomerLink {
  external_client_id: string;
  homeowner_id: string;
  link_state: LinkState;
}

export interface StrictPropertyLink {
  external_property_id: string;
  property_id: string;
  membership_id: string;
  link_state: LinkState;
}

export interface StrictAutoLinkDecision {
  outcome:
    | "link"
    | "already_linked"
    | "manual_review"
    | "insufficient_evidence"
    | "conflict"
    | "revocation_respected"
    | "archived";
  externalClientId: string;
  externalPropertyId: string | null;
  homeownerId: string | null;
  propertyId: string | null;
  membershipId: string | null;
  matchedBy: Array<"email" | "phone">;
  reason: string;
}

export interface StrictAutoLinkInput {
  clients: StrictJobberClient[];
  homeowners: StrictHomeowner[];
  properties: StrictProperty[];
  memberships: StrictMembership[];
  customerLinks: StrictCustomerLink[];
  propertyLinks: StrictPropertyLink[];
}

export interface JobberAutoLinkSummary {
  executionMode: "strict_exact_only";
  billingEnabled: false;
  evaluated: number;
  linked: number;
  alreadyLinked: number;
  manualReview: number;
  insufficientEvidence: number;
  conflictsBlocked: number;
  revocationsRespected: number;
  archivedSkipped: number;
  portalRepairsNeeded: number;
}

const STREET_SUFFIXES: Record<string, string> = {
  avenue: "ave",
  boulevard: "blvd",
  circle: "cir",
  court: "ct",
  drive: "dr",
  highway: "hwy",
  lane: "ln",
  parkway: "pkwy",
  place: "pl",
  road: "rd",
  street: "st",
  terrace: "ter",
  trail: "trl",
  way: "way",
};

const STATE_NAMES: Record<string, string> = {
  california: "ca",
};

function words(value: string): string[] {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeStreet(value: string | null | undefined): string | null {
  const tokens = words(value ?? "").map((token) => STREET_SUFFIXES[token] ?? token);
  return tokens.length ? tokens.join(" ") : null;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function normalizePhone(value: string | null | undefined): string | null {
  let digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

function normalizeLocality(value: string | null | undefined): string | null {
  const normalized = words(value ?? "").join(" ");
  return normalized || null;
}

function normalizeState(value: string | null | undefined): string | null {
  const normalized = normalizeLocality(value);
  return normalized ? (STATE_NAMES[normalized] ?? normalized) : null;
}

function normalizePostalCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (/^\d{5}(?:\d{4})?$/.test(normalized)) return normalized.slice(0, 5);
  return normalized.length >= 3 ? normalized : null;
}

function firstAddressValue(
  address: Record<string, string | null>,
  names: string[],
): string | null {
  for (const name of names) {
    const value = address[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function jobberAddressKey(
  address: Record<string, string | null> | null,
): string | null {
  if (!address) return null;
  const street1 = firstAddressValue(address, [
    "street",
    "streetAddress",
    "street1",
    "streetOne",
    "address1",
    "line1",
  ]);
  const street2 = street1 === address.street
    ? null
    : firstAddressValue(address, ["street2", "streetTwo", "address2", "line2"]);
  const street = normalizeStreet([street1, street2].filter(Boolean).join(" "));
  const city = normalizeLocality(firstAddressValue(address, ["city"]));
  const state = normalizeState(
    firstAddressValue(address, ["province", "provinceCode", "state", "stateCode"]),
  );
  const zip = normalizePostalCode(firstAddressValue(address, ["postalCode", "zipCode"]));
  return street && city && state && zip ? `${street}|${city}|${state}|${zip}` : null;
}

export function homeAtlasAddressKey(property: StrictProperty): string | null {
  const street = normalizeStreet(property.address);
  const city = normalizeLocality(property.city);
  const state = normalizeState(property.state);
  const zip = normalizePostalCode(property.zip);
  return street && city && state && zip ? `${street}|${city}|${state}|${zip}` : null;
}

function countValues(values: Array<string | null>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function decision(
  client: StrictJobberClient,
  outcome: StrictAutoLinkDecision["outcome"],
  reason: string,
  details: Partial<StrictAutoLinkDecision> = {},
): StrictAutoLinkDecision {
  return {
    outcome,
    externalClientId: client.external_client_id,
    externalPropertyId: null,
    homeownerId: null,
    propertyId: null,
    membershipId: null,
    matchedBy: [],
    reason,
    ...details,
  };
}

export function evaluateStrictExactCustomerLinks(
  input: StrictAutoLinkInput,
): StrictAutoLinkDecision[] {
  const propertiesByHomeowner = new Map<string, StrictProperty[]>();
  for (const property of input.properties) {
    const group = propertiesByHomeowner.get(property.homeowner_id) ?? [];
    group.push(property);
    propertiesByHomeowner.set(property.homeowner_id, group);
  }
  const homeownerById = new Map(input.homeowners.map((homeowner) => [homeowner.id, homeowner]));
  const propertyByAddress = new Map<string, StrictProperty[]>();
  for (const property of input.properties) {
    const key = homeAtlasAddressKey(property);
    if (!key) continue;
    const group = propertyByAddress.get(key) ?? [];
    group.push(property);
    propertyByAddress.set(key, group);
  }
  const jobberAddressCounts = countValues(
    input.clients.flatMap((client) =>
      client.properties_complete && client.property_count === 1 && client.properties?.length === 1
        ? [jobberAddressKey(client.properties[0].address)]
        : [],
    ),
  );
  const jobberEmailCounts = countValues(input.clients.map((client) => normalizeEmail(client.email)));
  const jobberPhoneCounts = countValues(input.clients.map((client) => normalizePhone(client.phone)));
  const homeEmailCounts = countValues(input.homeowners.map((owner) => normalizeEmail(owner.email)));
  const homePhoneCounts = countValues(input.homeowners.map((owner) => normalizePhone(owner.phone)));
  const customerLinkByExternal = new Map(
    input.customerLinks.map((link) => [link.external_client_id, link]),
  );
  const activeCustomerLinkByHomeowner = new Map(
    input.customerLinks
      .filter((link) => link.link_state === "active")
      .map((link) => [link.homeowner_id, link]),
  );
  const propertyLinkByExternal = new Map(
    input.propertyLinks.map((link) => [link.external_property_id, link]),
  );
  const activePropertyLinkByHome = new Map(
    input.propertyLinks
      .filter((link) => link.link_state === "active")
      .map((link) => [link.property_id, link]),
  );
  const eligibleMembershipsByProperty = new Map<string, StrictMembership[]>();
  for (const membership of input.memberships) {
    if (!isMembershipActive(membership)) continue;
    const group = eligibleMembershipsByProperty.get(membership.property_id) ?? [];
    group.push(membership);
    eligibleMembershipsByProperty.set(membership.property_id, group);
  }

  return input.clients.map((client) => {
    if (client.is_archived) return decision(client, "archived", "Archived Jobber customer");
    const existingCustomerLink = customerLinkByExternal.get(client.external_client_id);
    if (existingCustomerLink?.link_state === "revoked") {
      return decision(client, "revocation_respected", "Owner previously revoked this pairing");
    }
    if (existingCustomerLink?.link_state === "active") {
      return decision(client, "already_linked", "Existing active customer pairing", {
        homeownerId: existingCustomerLink.homeowner_id,
      });
    }
    if (
      !client.properties_complete ||
      client.property_count !== 1 ||
      client.properties?.length !== 1
    ) {
      return decision(client, "manual_review", "Automatic matching requires exactly one complete Jobber property");
    }
    const jobberProperty = client.properties[0];
    const addressKey = jobberAddressKey(jobberProperty.address);
    if (!addressKey) {
      return decision(client, "insufficient_evidence", "Complete Jobber property address unavailable", {
        externalPropertyId: jobberProperty.id,
      });
    }
    if ((jobberAddressCounts.get(addressKey) ?? 0) !== 1) {
      return decision(client, "manual_review", "Jobber property address is not unique", {
        externalPropertyId: jobberProperty.id,
      });
    }
    const homeProperties = propertyByAddress.get(addressKey) ?? [];
    if (homeProperties.length !== 1) {
      return decision(
        client,
        homeProperties.length > 1 ? "manual_review" : "insufficient_evidence",
        homeProperties.length > 1
          ? "Multiple HomeAtlas properties have the same normalized address"
          : "No exact HomeAtlas property address match",
        { externalPropertyId: jobberProperty.id },
      );
    }
    const property = homeProperties[0];
    const homeowner = homeownerById.get(property.homeowner_id);
    if (!homeowner || (propertiesByHomeowner.get(homeowner.id) ?? []).length !== 1) {
      return decision(client, "manual_review", "Automatic matching requires exactly one HomeAtlas property", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner?.id ?? null,
        propertyId: property.id,
      });
    }
    const memberships = eligibleMembershipsByProperty.get(property.id) ?? [];
    if (memberships.length !== 1 || memberships[0].homeowner_id !== homeowner.id) {
      return decision(client, "insufficient_evidence", "Exactly one active membership is required", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
      });
    }
    const membership = memberships[0];
    const clientEmail = normalizeEmail(client.email);
    const clientPhone = normalizePhone(client.phone);
    const homeEmail = normalizeEmail(homeowner.email);
    const homePhone = normalizePhone(homeowner.phone);
    if (clientEmail && homeEmail && clientEmail !== homeEmail) {
      return decision(client, "conflict", "Comparable email values conflict", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
        membershipId: membership.id,
      });
    }
    if (clientPhone && homePhone && clientPhone !== homePhone) {
      return decision(client, "conflict", "Comparable phone values conflict", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
        membershipId: membership.id,
      });
    }
    const matchedBy: Array<"email" | "phone"> = [];
    if (
      clientEmail &&
      clientEmail === homeEmail &&
      jobberEmailCounts.get(clientEmail) === 1 &&
      homeEmailCounts.get(clientEmail) === 1
    ) {
      matchedBy.push("email");
    }
    if (
      clientPhone &&
      clientPhone === homePhone &&
      jobberPhoneCounts.get(clientPhone) === 1 &&
      homePhoneCounts.get(clientPhone) === 1
    ) {
      matchedBy.push("phone");
    }
    if (matchedBy.length === 0) {
      return decision(client, "insufficient_evidence", "No unique exact email or phone match", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
        membershipId: membership.id,
      });
    }
    const homeownerConflict = activeCustomerLinkByHomeowner.get(homeowner.id);
    if (homeownerConflict && homeownerConflict.external_client_id !== client.external_client_id) {
      return decision(client, "conflict", "HomeAtlas customer is already paired elsewhere", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
        membershipId: membership.id,
        matchedBy,
      });
    }
    const externalPropertyLink = propertyLinkByExternal.get(jobberProperty.id);
    if (externalPropertyLink?.link_state === "revoked") {
      return decision(client, "revocation_respected", "Owner previously revoked this property pairing", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
        membershipId: membership.id,
        matchedBy,
      });
    }
    if (
      externalPropertyLink?.link_state === "active" &&
      (externalPropertyLink.property_id !== property.id ||
        externalPropertyLink.membership_id !== membership.id)
    ) {
      return decision(client, "conflict", "Jobber property is already paired elsewhere", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
        membershipId: membership.id,
        matchedBy,
      });
    }
    const homePropertyConflict = activePropertyLinkByHome.get(property.id);
    if (
      homePropertyConflict &&
      homePropertyConflict.external_property_id !== jobberProperty.id
    ) {
      return decision(client, "conflict", "HomeAtlas property is already paired elsewhere", {
        externalPropertyId: jobberProperty.id,
        homeownerId: homeowner.id,
        propertyId: property.id,
        membershipId: membership.id,
        matchedBy,
      });
    }
    return decision(client, "link", AUTO_LINK_REASON, {
      externalPropertyId: jobberProperty.id,
      homeownerId: homeowner.id,
      propertyId: property.id,
      membershipId: membership.id,
      matchedBy,
    });
  });
}

export async function reconcileStrictExactJobberCustomerLinks(): Promise<JobberAutoLinkSummary> {
  const supabase = createServiceRoleSupabaseClient();
  const [clients, homeowners, properties, memberships, customerLinks, propertyLinks] =
    await Promise.all([
      supabase
        .from("jobber_client_projections")
        .select("external_client_id, email, phone, is_archived, properties, property_count, properties_complete")
        .eq("connection_id", JOBBER_CONNECTION_ID),
      supabase.from("homeowners").select("id, email, phone"),
      supabase.from("properties").select("id, homeowner_id, address, city, state, zip"),
      supabase
        .from("memberships")
        .select(
          "id, homeowner_id, property_id, status, payment_setup_completed_at, stripe_payment_method_id, stripe_customer_id, payment_rail, manual_payment_approved_at, manual_payment_approved_by, agreement_id, sales_tier, visit_price",
        ),
      supabase
        .from("jobber_customer_links")
        .select("external_client_id, homeowner_id, link_state")
        .eq("connection_id", JOBBER_CONNECTION_ID),
      supabase
        .from("jobber_property_links")
        .select("external_property_id, property_id, membership_id, link_state")
        .eq("connection_id", JOBBER_CONNECTION_ID),
    ]);
  for (const result of [clients, homeowners, properties, memberships, customerLinks, propertyLinks]) {
    if (result.error) throw new Error(result.error.message);
  }
  const decisions = evaluateStrictExactCustomerLinks({
    clients: (clients.data ?? []) as StrictJobberClient[],
    homeowners: (homeowners.data ?? []) as StrictHomeowner[],
    properties: (properties.data ?? []) as StrictProperty[],
    memberships: (memberships.data ?? []) as StrictMembership[],
    customerLinks: (customerLinks.data ?? []) as StrictCustomerLink[],
    propertyLinks: (propertyLinks.data ?? []) as StrictPropertyLink[],
  });
  const summary: JobberAutoLinkSummary = {
    executionMode: "strict_exact_only",
    billingEnabled: false,
    evaluated: decisions.length,
    linked: 0,
    alreadyLinked: decisions.filter((item) => item.outcome === "already_linked").length,
    manualReview: decisions.filter((item) => item.outcome === "manual_review").length,
    insufficientEvidence: decisions.filter((item) => item.outcome === "insufficient_evidence").length,
    conflictsBlocked: decisions.filter((item) => item.outcome === "conflict").length,
    revocationsRespected: decisions.filter((item) => item.outcome === "revocation_respected").length,
    archivedSkipped: decisions.filter((item) => item.outcome === "archived").length,
    portalRepairsNeeded: 0,
  };

  for (const item of decisions.filter((candidate) => candidate.outcome === "link")) {
    const inserted = await supabase.from("jobber_customer_links").insert({
      connection_id: JOBBER_CONNECTION_ID,
      external_client_id: item.externalClientId,
      homeowner_id: item.homeownerId!,
      link_state: "active",
      linked_by: AUTO_LINK_ACTOR,
      link_reason: AUTO_LINK_REASON,
      linked_at: new Date().toISOString(),
    });
    if (inserted.error) {
      if (inserted.error.code === "23505") {
        summary.conflictsBlocked += 1;
        continue;
      }
      throw new Error(inserted.error.message);
    }
    summary.linked += 1;
    try {
      const portal = await reconcilePairedCustomerPortalVisit({
        externalClientId: item.externalClientId,
        homeownerId: item.homeownerId!,
        automaticPropertyLinkEvidence: {
          actor: AUTO_LINK_ACTOR,
          reason: AUTO_LINK_REASON,
        },
      });
      if (portal.status === "error" || portal.status === "needs_property_review") {
        summary.portalRepairsNeeded += 1;
      }
    } catch {
      summary.portalRepairsNeeded += 1;
    }
  }
  return summary;
}
