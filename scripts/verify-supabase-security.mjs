#!/usr/bin/env node
/**
 * Post-migration 042 checks: public access to customer data and encrypted
 * provider credentials is closed while the service role remains healthy.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... npm run verify:supabase-security
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // CI or an operator shell may supply the variables directly.
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sensitiveTables = [
  "homeowners",
  "properties",
  "home_care_plans",
  "memberships",
  "signed_agreements",
  "property_assets",
  "lead_intakes",
  "customer_contact_points",
  "customer_communication_automation_rules",
  "customer_conversations",
  "customer_messages",
  "customer_communication_webhook_events",
  "google_business_connections",
  "member_profiles",
  "member_savings_transactions",
  "service_observations",
  "ai_quotes",
  "property_assessments",
  "property_visit_health_checks",
  "member_addon_transactions",
  "agreement_document_versions",
  "enrollment_packets",
  "enrollment_packet_events",
];

let failed = false;

const [servicePostureResult, anonPostureResult] = await Promise.all([
  service.rpc("homeatlas_security_posture"),
  anon.rpc("homeatlas_security_posture"),
]);
const { data: postureData, error: postureError } = servicePostureResult;
const posture = Array.isArray(postureData) ? postureData[0] : postureData;

const anonPostureClosed = Boolean(anonPostureResult.error);
console.log(
  `security posture RPC          ${anonPostureClosed ? "SERVICE ONLY" : "PUBLIC"}`,
);
if (!anonPostureClosed) failed = true;

if (postureError || !posture) {
  console.error(
    `service_role security posture DENIED (${postureError?.message ?? "no result"})`,
  );
  failed = true;
} else {
  const policyCount = Number(posture.customer_public_policy_count ?? -1);
  const privilegeCount = Number(posture.customer_public_privilege_count ?? -1);
  const rateLimitReady = posture.admin_rate_limit_ready === true;

  console.log(`customer public policies      ${policyCount}`);
  console.log(`customer public privileges   ${privilegeCount}`);
  console.log(`admin unlock rate limit      ${rateLimitReady ? "READY" : "MISSING"}`);

  if (policyCount !== 0 || privilegeCount !== 0 || !rateLimitReady) {
    failed = true;
  }
}

for (const table of sensitiveTables) {
  const [serviceResult, anonResult] = await Promise.all([
    service.from(table).select("*").limit(1),
    anon.from(table).select("*").limit(1),
  ]);

  const serviceOk = !serviceResult.error;
  const anonRows = anonResult.data?.length ?? 0;
  const anonClosed = Boolean(anonResult.error) || anonRows === 0;
  console.log(
    `${table.padEnd(24)} service=${serviceOk ? "OK" : "DENIED"} anon=${anonClosed ? "CLOSED" : "EXPOSED"}`,
  );

  if (!serviceOk || !anonClosed) failed = true;
}

const visitBucketResult = await service.storage.getBucket(
  "homeatlas-visit-media",
);
const visitBucketPrivate =
  !visitBucketResult.error && visitBucketResult.data?.public === false;
console.log(
  `visit media bucket           ${visitBucketPrivate ? "PRIVATE" : "MISSING OR PUBLIC"}`,
);
if (!visitBucketPrivate) failed = true;

if (failed) {
  console.error("\nSecurity verification failed - apply all required migrations through 066.");
  process.exit(1);
}

console.log("\nSecurity verification passed.");
