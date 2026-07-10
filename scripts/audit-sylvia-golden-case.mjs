#!/usr/bin/env node
/**
 * Read-only golden-case audit for Sylvia Siegel production membership.
 * Usage: node scripts/audit-sylvia-golden-case.mjs
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * (service role needed for appointments, add-ons, and agreement reads post-RLS 030).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const MEMBERSHIP_ID = "cdd45fa1-8728-41b1-aa7c-1f34ae97ccc4";
const PROPERTY_ID = "5c8ab9f1-4145-4427-840d-c11a0faecafa";
const HOMEOWNER_ID = "1364b89e-f4de-4120-b43f-78f15057329c";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const key = serviceKey || anonKey;
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const usingServiceRole = Boolean(serviceKey);

function isMembershipActive(row) {
  if (!row) return false;
  if (row.status !== "active") return false;
  if (!row.payment_setup_completed_at?.trim()) return false;
  if (row.agreement_id !== undefined && !row.agreement_id?.trim()) return false;
  if (row.sales_tier !== undefined && !row.sales_tier?.trim()) return false;
  if (row.visit_price !== undefined && row.visit_price == null) return false;
  return true;
}

function redact(row) {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };
  for (const k of Object.keys(copy)) {
    if (k.includes("token") || k.startsWith("stripe_")) {
      copy[k] = copy[k] ? "[REDACTED]" : copy[k];
    }
  }
  return copy;
}

const rows = [];

function record(surface, field, expected, actual, ok, note) {
  rows.push({ surface, field, expected, actual, ok, note: note ?? "" });
}

async function main() {
  console.log(`Sylvia golden-case audit (${usingServiceRole ? "service role" : "anon"})\n`);

  const { data: membership, error: mErr } = await supabase
    .from("memberships")
    .select("*")
    .eq("id", MEMBERSHIP_ID)
    .maybeSingle();

  if (mErr) {
    console.error("memberships query failed:", mErr.message);
    process.exit(1);
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, slug, name, address, city, homeowner_id")
    .eq("id", PROPERTY_ID)
    .maybeSingle();

  const { data: homeowner } = await supabase
    .from("homeowners")
    .select("id, slug, full_name, email")
    .eq("id", HOMEOWNER_ID)
    .maybeSingle();

  let agreement = null;
  if (membership?.agreement_id) {
    const { data, error } = await supabase
      .from("signed_agreements")
      .select(
        "id, status, plan_name, signed_at, agreement_pdf_url, property_slug, membership_id, presentation_id",
      )
      .eq("id", membership.agreement_id)
      .maybeSingle();
    if (error) record("signed_agreements", "read", "no error", error.message, false);
    agreement = data;
  }

  const { data: appointments, error: aErr } = await supabase
    .from("member_appointments")
    .select("id, scheduled_at, status, service_type, notes, completed_at")
    .eq("property_id", PROPERTY_ID)
    .order("scheduled_at", { ascending: true });

  const { data: addons, error: addonErr } = await supabase
    .from("member_addon_transactions")
    .select(
      "id, service_name, service_date, status, amount_charged_cents, saved_cents, retail_price_cents",
    )
    .eq("membership_id", MEMBERSHIP_ID);

  const { data: presentation } = membership?.presentation_id
    ? await supabase
        .from("presentations")
        .select("id, status, onboarding_status, tier, membership_id")
        .eq("id", membership.presentation_id)
        .maybeSingle()
    : await supabase
        .from("presentations")
        .select("id, status, onboarding_status, tier, membership_id")
        .eq("property_id", PROPERTY_ID)
        .maybeSingle();

  // --- Cross-surface checks ---
  record("memberships", "row exists", "present", membership ? "present" : "missing", Boolean(membership));
  record(
    "memberships",
    "property_id",
    PROPERTY_ID,
    membership?.property_id ?? "null",
    membership?.property_id === PROPERTY_ID,
  );
  record(
    "memberships",
    "strict isMembershipActive",
    "true",
    String(isMembershipActive(membership)),
    isMembershipActive(membership),
    `status=${membership?.status}`,
  );
  record(
    "memberships",
    "payment_setup_completed_at",
    "set",
    membership?.payment_setup_completed_at ? "set" : "null",
    Boolean(membership?.payment_setup_completed_at),
  );
  record(
    "memberships",
    "agreement_id",
    "set",
    membership?.agreement_id ? "set" : "null",
    Boolean(membership?.agreement_id),
  );
  record(
    "memberships",
    "sales_tier",
    "biannual",
    membership?.sales_tier ?? "null",
    membership?.sales_tier === "biannual",
  );
  record(
    "memberships",
    "visit_price",
    "300 (production contract)",
    String(membership?.visit_price ?? "null"),
    membership?.visit_price === 300,
  );

  if (agreement) {
    record(
      "signed_agreements",
      "status",
      "complete",
      agreement.status,
      agreement.status === "complete",
    );
    const tierMatch =
      (agreement.plan_name ?? "").toLowerCase().includes("bi") ||
      (agreement.plan_name ?? "").toLowerCase().includes(membership?.sales_tier ?? "");
    record(
      "signed_agreements",
      "plan_name vs membership tier",
      membership?.sales_tier,
      agreement.plan_name,
      tierMatch,
    );
    if (agreement.visit_price != null) {
      record(
        "signed_agreements",
        "visit_price vs membership",
        String(membership?.visit_price),
        String(agreement.visit_price),
        Math.abs(agreement.visit_price - (membership?.visit_price ?? -2)) < 0.01,
      );
    }
    record(
      "signed_agreements",
      "membership_id vs membership",
      MEMBERSHIP_ID,
      agreement.membership_id ?? "null",
      agreement.membership_id === MEMBERSHIP_ID,
    );
  } else {
    record("signed_agreements", "row via agreement_id", "present", "missing", false);
  }

  if (aErr) {
    record("member_appointments", "read", "no error", aErr.message, false, "RLS or service role");
  } else {
    const future = (appointments ?? []).filter(
      (a) => new Date(a.scheduled_at).getTime() > Date.now(),
    );
    record(
      "member_appointments",
      "future scheduled visit",
      ">=1",
      String(future.length),
      future.length > 0,
    );
    const next = future[0] ?? appointments?.[appointments.length - 1];
    if (next) {
      record(
        "member_appointments",
        "next visit status",
        "scheduled",
        next.status,
        next.status === "scheduled",
      );
    }
  }

  if (addonErr) {
    record("member_addon_transactions", "read", "no error", addonErr.message, false);
  } else {
    const moss = (addons ?? []).find((a) =>
      (a.service_name ?? "").toLowerCase().includes("moss"),
    );
    record(
      "member_addon_transactions",
      "moss add-on row",
      "present",
      moss ? "present" : "missing",
      Boolean(moss),
    );
    if (moss) {
      record(
        "member_addon_transactions",
        "moss amount_charged_cents",
        "30000",
        String(moss.amount_charged_cents),
        moss.amount_charged_cents === 30000,
      );
      record(
        "member_addon_transactions",
        "moss saved_cents",
        "7500",
        String(moss.saved_cents),
        moss.saved_cents === 7500,
      );
      record(
        "member_addon_transactions",
        "moss status",
        "paid",
        moss.status,
        moss.status === "paid",
      );
    }
  }

  if (presentation) {
    record(
      "presentations",
      "status",
      "signed",
      presentation.status,
      presentation.status === "signed",
    );
    record(
      "presentations",
      "tier vs membership",
      membership?.sales_tier,
      presentation.tier,
      presentation.tier === membership?.sales_tier,
    );
  }

  record(
    "homeowners",
    "slug",
    "sylvia-siegel",
    homeowner?.slug ?? "null",
    homeowner?.slug === "sylvia-siegel",
  );
  record(
    "properties",
    "slug",
    "366-brookside-drive",
    property?.slug ?? "null",
    property?.slug === "366-brookside-drive",
  );
  record(
    "memberships",
    "membership_enrollment_savings",
    "locked at activation",
    membership?.membership_enrollment_savings == null ? "null" : "set",
    membership?.membership_enrollment_savings != null,
    "Slice 3: persistMembershipEnrollmentSavings may not have run",
  );
  record(
    "properties",
    "city",
    "real city",
    property?.city ?? "null",
    property?.city != null && property.city !== "TBD",
    "data quality — city still TBD",
  );

  if (!usingServiceRole) {
    record(
      "audit",
      "service role",
      "configured",
      "missing — appointments/add-ons may be RLS-empty",
      false,
      "Re-run with SUPABASE_SERVICE_ROLE_KEY for full cross-table audit",
    );
  }

  // Print table
  console.log("| Surface | Field | Expected | Actual | OK | Note |");
  console.log("|---------|-------|----------|--------|----|------|");
  for (const r of rows) {
    console.log(
      `| ${r.surface} | ${r.field} | ${r.expected} | ${r.actual} | ${r.ok ? "PASS" : "FAIL"} | ${r.note} |`,
    );
  }

  const fails = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length} checks: ${rows.length - fails.length} pass, ${fails.length} fail`);

  console.log("\n--- Redacted snapshot ---");
  console.log(
    JSON.stringify(
      {
        membership: redact(membership),
        property,
        homeowner,
        agreement: redact(agreement),
        appointments,
        addons,
        presentation,
      },
      null,
      2,
    ),
  );

  process.exit(fails.length > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
