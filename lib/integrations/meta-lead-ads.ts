import type { CreateLeadIntakeInput } from "@/lib/acquisition/lead-record";
import type { ServiceOption } from "@/lib/acquisition/types";
import { normalizeE164 } from "@/lib/communications/providers/contracts";

export interface MetaLeadWebhookReference {
  leadgenId: string;
  pageId: string | null;
  formId: string | null;
}

interface MetaFieldData {
  name?: unknown;
  values?: unknown;
}

export interface MetaLeadDetails {
  id?: unknown;
  created_time?: unknown;
  ad_id?: unknown;
  ad_name?: unknown;
  adset_id?: unknown;
  adset_name?: unknown;
  campaign_id?: unknown;
  campaign_name?: unknown;
  form_id?: unknown;
  field_data?: unknown;
}

export interface MetaSmsConsentConfiguration {
  approvedFormIds: ReadonlySet<string>;
  consentFieldNames: ReadonlySet<string>;
  disclosureVersion: string | null;
}

function clean(value: unknown, max = 500): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function fieldMap(fieldData: unknown): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!Array.isArray(fieldData)) return map;
  for (const item of fieldData as MetaFieldData[]) {
    const name = clean(item?.name, 120).toLowerCase();
    if (!name || !Array.isArray(item?.values)) continue;
    const values = item.values.map((value) => clean(value)).filter(Boolean);
    if (values.length) map.set(name, values);
  }
  return map;
}

function firstField(fields: Map<string, string[]>, names: readonly string[]): string {
  for (const name of names) {
    const value = fields.get(name)?.[0];
    if (value) return value;
  }
  return "";
}

function affirmative(value: string): boolean {
  return ["yes", "true", "1", "agree", "agreed", "i agree", "opt in", "opted in"].includes(
    value.trim().toLowerCase(),
  );
}

function servicesFromFields(fields: Map<string, string[]>): ServiceOption[] {
  const haystack = [...fields.entries()]
    .filter(([name]) => name.includes("service") || name.includes("interested"))
    .flatMap(([, values]) => values)
    .join(" ")
    .toLowerCase();
  const rules: Array<[ServiceOption, RegExp]> = [
    ["Window Cleaning", /window/],
    ["Gutter Cleaning", /gutter/],
    ["Pressure Washing", /pressure|power wash/],
    ["Solar Panel Cleaning", /solar/],
    ["Exterior Home Care", /exterior|cobweb/],
    ["Full Home Care Membership", /membership|quarterly|bi.?annual|service plan/],
  ];
  return rules.filter(([, pattern]) => pattern.test(haystack)).map(([service]) => service);
}

function buildAddress(fields: Map<string, string[]>): string {
  const direct = firstField(fields, ["street_address", "address", "service_address"]);
  const city = firstField(fields, ["city"]);
  const state = firstField(fields, ["state", "province"]);
  const zip = firstField(fields, ["zip_code", "postal_code", "zip"]);
  return [direct, city, state, zip].filter(Boolean).join(", ");
}

function noteLines(fields: Map<string, string[]>): string[] {
  const ignored = new Set([
    "full_name", "name", "first_name", "last_name", "phone_number", "phone",
    "email", "street_address", "address", "service_address", "city", "state",
    "province", "zip_code", "postal_code", "zip",
  ]);
  return [...fields.entries()]
    .filter(([name]) => !ignored.has(name) && !name.includes("consent"))
    .slice(0, 20)
    .map(([name, values]) => `${name.replaceAll("_", " ")}: ${values.join(", ")}`);
}

export function parseMetaLeadWebhookPayload(rawPayload: string): MetaLeadWebhookReference[] | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { object?: unknown; entry?: unknown };
  if (root.object !== "page" || !Array.isArray(root.entry)) return null;
  const leads = new Map<string, MetaLeadWebhookReference>();
  for (const entry of root.entry as Array<{ id?: unknown; changes?: unknown }>) {
    if (!Array.isArray(entry?.changes)) continue;
    for (const change of entry.changes as Array<{ field?: unknown; value?: unknown }>) {
      if (change?.field !== "leadgen" || !change.value || typeof change.value !== "object") continue;
      const value = change.value as Record<string, unknown>;
      const leadgenId = clean(value.leadgen_id, 120);
      if (!leadgenId) continue;
      leads.set(leadgenId, {
        leadgenId,
        pageId: clean(value.page_id ?? entry.id, 120) || null,
        formId: clean(value.form_id, 120) || null,
      });
    }
  }
  return [...leads.values()];
}

export function metaLeadToIntakeInput(input: {
  reference: MetaLeadWebhookReference;
  details: MetaLeadDetails;
  consent: MetaSmsConsentConfiguration;
}): CreateLeadIntakeInput | null {
  const externalLeadId = clean(input.details.id, 120) || input.reference.leadgenId;
  const fields = fieldMap(input.details.field_data);
  const fullName = firstField(fields, ["full_name", "name"]);
  const firstName = firstField(fields, ["first_name"]);
  const lastName = firstField(fields, ["last_name"]);
  const name = fullName || [firstName, lastName].filter(Boolean).join(" ");
  const phone = normalizeE164(firstField(fields, ["phone_number", "phone"]));
  if (!externalLeadId || !name || !phone) return null;

  const formId = clean(input.details.form_id, 120) || input.reference.formId || "";
  const consentValue = [...input.consent.consentFieldNames]
    .map((fieldName) => fields.get(fieldName)?.[0] ?? "")
    .find(affirmative);
  const optedIn = Boolean(
    formId &&
      input.consent.approvedFormIds.has(formId) &&
      input.consent.disclosureVersion &&
      consentValue,
  );
  const services = servicesFromFields(fields);

  return {
    name,
    phone,
    email: firstField(fields, ["email"]),
    serviceAddress: buildAddress(fields),
    servicesInterested: services,
    preferredContactMethod: optedIn ? "Text" : "Phone",
    smsConsentStatus: optedIn ? "opted_in" : "unknown",
    smsConsentDisclosureVersion: optedIn ? input.consent.disclosureVersion : null,
    smsConsentSourcePath: optedIn ? `meta-lead-form:${formId}` : null,
    smsConsentIpAddress: null,
    smsConsentUserAgent: null,
    notes: noteLines(fields).join("\n"),
    membershipTier: null,
    squareFootage: null,
    estimatedVisitPrice: null,
    preferredStartWindow: null,
    source: "facebook_lead_ad",
    externalLeadId,
    sourcePageId: input.reference.pageId,
    sourceFormId: formId || null,
    sourceCampaignId: clean(input.details.campaign_id, 120) || null,
    sourceCampaignName: clean(input.details.campaign_name) || null,
    sourceAdsetId: clean(input.details.adset_id, 120) || null,
    sourceAdsetName: clean(input.details.adset_name) || null,
    sourceAdId: clean(input.details.ad_id, 120) || null,
    sourceAdName: clean(input.details.ad_name) || null,
  };
}
