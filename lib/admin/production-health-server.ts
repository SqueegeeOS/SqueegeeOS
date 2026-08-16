import { allowsMockWebsiteMembershipSales } from "@/lib/admin/website-membership-sales";
import { runIntegrationAutomationChecks } from "@/lib/admin/integration-automation-health";
import type {
  ProductionHealthCheck,
  ProductionHealthReport,
  ProductionHealthSection,
  ProductionHealthStatus,
} from "@/lib/admin/production-health-types";
import {
  isSignedAgreementStorageRef,
  probeSignedAgreementsBucketPublic,
  resolveAgreementPdfAccessUrl,
  SIGNED_AGREEMENT_BUCKET,
} from "@/lib/agreement/signed-agreement-storage";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { getStripePublishableKey } from "@/lib/stripe/client";
import { isStripeLiveMode, resolveStripeKeyMode } from "@/lib/stripe/mode";
import { normalizeToSqueegeeKingTier } from "@/lib/membership/tier-config";
import { isMembershipActive } from "@/lib/membership/membership-status";
import { VISIT_MEDIA_BUCKET } from "@/lib/field-records/visit-field-record";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ColumnProbeResult {
  ok: boolean;
  missing: boolean;
  message: string;
}

const ONBOARDING_CRITICAL_SECTIONS = new Map([
  ["schema", "schema migrations incomplete"],
  ["stripe", "Stripe not production-ready"],
  ["storage", "agreement storage unsafe"],
  ["agreement", "agreement signing is not ready"],
  ["sales-billing", "sales and billing readiness is blocked"],
  ["integrity", "customer data integrity issues"],
  ["privacy", "customer data privacy is not closed"],
  ["persistence", "cloud persistence is not ready"],
]);

function worstStatus(statuses: ProductionHealthStatus[]): ProductionHealthStatus {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("yellow")) return "yellow";
  return "green";
}

function sectionFromChecks(
  id: string,
  title: string,
  checks: ProductionHealthCheck[],
): ProductionHealthSection {
  return {
    id,
    title,
    checks,
    status: worstStatus(checks.map((check) => check.status)),
  };
}

function check(
  id: string,
  label: string,
  status: ProductionHealthStatus,
  message: string,
  detail?: string,
): ProductionHealthCheck {
  return { id, label, status, message, detail };
}

async function probeTableColumn(
  supabase: SupabaseClient,
  table: string,
  column?: string,
): Promise<ColumnProbeResult> {
  const selection = column ?? "id";
  const { error } = await supabase.from(table).select(selection).limit(0);

  if (!error) {
    return {
      ok: true,
      missing: false,
      message: column ? "Column present" : "Table present",
    };
  }

  const message = error.message;
  if (message.includes("does not exist")) {
    if (
      message.includes(`relation "${table}"`) ||
      message.includes(`relation \"${table}\"`) ||
      message.includes(`table '${table}'`)
    ) {
      return { ok: false, missing: true, message: `Table missing — run migrations` };
    }
    if (column) {
      return {
        ok: false,
        missing: true,
        message: `Column missing — run migrations`,
      };
    }
  }

  return { ok: false, missing: false, message };
}

function schemaCheck(
  id: string,
  label: string,
  probe: ColumnProbeResult,
): ProductionHealthCheck {
  if (probe.ok) {
    return check(id, label, "green", probe.message);
  }
  if (probe.missing) {
    return check(id, label, "red", probe.message, label);
  }
  return check(id, label, "yellow", probe.message);
}

async function runSchemaChecks(
  supabase: SupabaseClient,
): Promise<ProductionHealthSection> {
  const targets: Array<{
    id: string;
    label: string;
    table: string;
    column?: string;
  }> = [
    {
      id: "presentation-enrollment-savings-schema",
      label: "presentations.enrollment_savings",
      table: "presentations",
      column: "enrollment_savings",
    },
    {
      id: "membership-enrollment-savings-schema",
      label: "memberships.membership_enrollment_savings",
      table: "memberships",
      column: "membership_enrollment_savings",
    },
    {
      id: "website-membership-sales-schema",
      label: "website_membership_sales",
      table: "website_membership_sales",
    },
    {
      id: "membership-billing-charges-schema",
      label: "membership_billing_charges",
      table: "membership_billing_charges",
    },
    { id: "obligations-schema", label: "obligations", table: "obligations" },
    {
      id: "obligation-events-schema",
      label: "obligation_events",
      table: "obligation_events",
    },
    {
      id: "agreement-signature-storage-schema",
      label: "signed_agreements.signature_image_storage_path",
      table: "signed_agreements",
      column: "signature_image_storage_path",
    },
    {
      id: "agreement-pdf-schema",
      label: "signed_agreements.agreement_pdf_url",
      table: "signed_agreements",
      column: "agreement_pdf_url",
    },
    {
      id: "agreement-authorized-price-schema",
      label: "signed_agreements.authorized_visit_price_cents",
      table: "signed_agreements",
      column: "authorized_visit_price_cents",
    },
    {
      id: "automatic-billing-membership-schema",
      label: "memberships.automatic_billing_enabled",
      table: "memberships",
      column: "automatic_billing_enabled",
    },
    {
      id: "billing-automation-settings-schema",
      label: "billing_automation_settings",
      table: "billing_automation_settings",
    },
    {
      id: "jobber-membership-links-schema",
      label: "jobber_membership_job_links",
      table: "jobber_membership_job_links",
    },
    {
      id: "lead-sms-consent-schema",
      label: "lead_intakes.sms_consent_disclosure_version",
      table: "lead_intakes",
      column: "sms_consent_disclosure_version",
    },
    {
      id: "customer-contact-consent-schema",
      label: "customer_contact_consent_events",
      table: "customer_contact_consent_events",
    },
    {
      id: "provider-verification-schema",
      label: "customer_communication_provider_verifications",
      table: "customer_communication_provider_verifications",
    },
    {
      id: "field-record-media-schema",
      label: "property_assets.storage_bucket",
      table: "property_assets",
      column: "storage_bucket",
    },
    {
      id: "field-record-follow-up-schema",
      label: "property_assessments.follow_up_status",
      table: "property_assessments",
      column: "follow_up_status",
    },
    {
      id: "field-record-service-scope-schema",
      label: "property_assessments.service_scope",
      table: "property_assessments",
      column: "service_scope",
    },
    {
      id: "technician-field-access-schema",
      label: "technician_access_grants",
      table: "technician_access_grants",
    },
    {
      id: "sales-rep-phone-access-schema",
      label: "sales_rep_access_grants",
      table: "sales_rep_access_grants",
    },
    {
      id: "sales-request-assignment-schema",
      label: "sales_rep_leads.lead_intake_id",
      table: "sales_rep_leads",
      column: "lead_intake_id",
    },
    {
      id: "sales-lead-interactions-schema",
      label: "sales_rep_lead_interactions",
      table: "sales_rep_lead_interactions",
    },
    {
      id: "technician-visit-automation-schema",
      label: "technician_visit_events",
      table: "technician_visit_events",
    },
    {
      id: "customer-aftercare-schema",
      label: "customer_aftercare_resolutions",
      table: "customer_aftercare_resolutions",
    },
    {
      id: "customer-service-cases-schema",
      label: "customer_service_cases",
      table: "customer_service_cases",
    },
    {
      id: "growth-work-sessions-schema",
      label: "growth_work_sessions",
      table: "growth_work_sessions",
    },
    {
      id: "field-independence-reviews-schema",
      label: "field_independence_reviews",
      table: "field_independence_reviews",
    },
    {
      id: "technician-competency-assessments-schema",
      label: "technician_competency_assessments",
      table: "technician_competency_assessments",
    },
    {
      id: "technician-independent-day-trials-schema",
      label: "technician_independent_day_trials",
      table: "technician_independent_day_trials",
    },
    {
      id: "technician-capacity-plans-schema",
      label: "technician_capacity_plans",
      table: "technician_capacity_plans",
    },
  ];

  const probes = await Promise.all(
    targets.map((target) =>
      probeTableColumn(supabase, target.table, target.column),
    ),
  );
  const checks = targets.map((target, index) =>
    schemaCheck(target.id, target.label, probes[index]!),
  );

  return sectionFromChecks("schema", "Database migrations / schema", checks);
}

interface SecurityPostureRow {
  customer_public_policy_count: number | string | null;
  customer_public_privilege_count: number | string | null;
  admin_rate_limit_ready: boolean | null;
}

async function runCustomerPrivacyChecks(
  supabase: SupabaseClient,
): Promise<ProductionHealthSection> {
  const { data, error } = await supabase.rpc("homeatlas_security_posture");
  const row = (Array.isArray(data) ? data[0] : data) as
    | SecurityPostureRow
    | null;

  if (error || !row) {
    return sectionFromChecks("privacy", "Customer data privacy", [
      check(
        "privacy-posture",
        "Server-only customer tables",
        "red",
        "Security posture unavailable — apply migration 040",
        error?.message,
      ),
    ]);
  }

  const policyCount = Number(row.customer_public_policy_count ?? -1);
  const privilegeCount = Number(row.customer_public_privilege_count ?? -1);
  return sectionFromChecks("privacy", "Customer data privacy", [
    check(
      "privacy-policies",
      "Anonymous table policies",
      policyCount === 0 ? "green" : "red",
      policyCount === 0
        ? "Customer and quote-request tables have no public policies"
        : `${policyCount} public customer-table policy/policies must be removed`,
    ),
    check(
      "privacy-privileges",
      "Anonymous table privileges",
      privilegeCount === 0 ? "green" : "red",
      privilegeCount === 0
        ? "Customer and quote-request tables are server-only"
        : `${privilegeCount} public customer-table privilege(s) must be revoked`,
    ),
    check(
      "privacy-admin-throttle",
      "HQ unlock protection",
      row.admin_rate_limit_ready ? "green" : "red",
      row.admin_rate_limit_ready
        ? "Durable unlock throttling is available"
        : "Admin unlock rate-limit table is missing",
    ),
  ]);
}

function runStripeChecks(): ProductionHealthSection {
  const publishable = Boolean(getStripePublishableKey());
  const secret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripeEnabled = isStripeServerEnabled();
  const keyMode = resolveStripeKeyMode();
  const liveMode = isStripeLiveMode();
  const mockEnabled = allowsMockWebsiteMembershipSales();
  const setupRouteReady = isSupabaseConfigured() && stripeEnabled;
  const webhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());

  const checks: ProductionHealthCheck[] = [
    check(
      "stripe-configured",
      "Stripe keys configured",
      stripeEnabled ? "green" : "red",
      stripeEnabled
        ? "Publishable and secret keys present"
        : "Stripe keys missing — card-on-file will fail",
    ),
    check(
      "stripe-live-mode",
      "Stripe live mode",
      liveMode ? "green" : stripeEnabled ? "yellow" : "red",
      liveMode
        ? "Live keys configured"
        : keyMode === "test"
          ? "Test keys — not ready for real customers"
          : "Live Stripe keys required for production onboarding",
    ),
    check(
      "stripe-setup-intent-route",
      "Card setup route ready",
      setupRouteReady ? "green" : "red",
      setupRouteReady
        ? "/api/stripe/setup-intent prerequisites satisfied"
        : "SetupIntent route will return 503",
    ),
    check(
      "stripe-billing-webhook",
      "Automatic billing webhook",
      webhookReady ? "green" : "yellow",
      webhookReady
        ? "Webhook signing secret is loaded; confirm a signed delivery in Billing Control before arming"
        : "STRIPE_WEBHOOK_SECRET missing — automatic billing stays unavailable",
    ),
    check(
      "stripe-mock-mode",
      "Mock/demo payment mode",
      mockEnabled
        ? "red"
        : !stripeEnabled
          ? "red"
          : "green",
      mockEnabled
        ? "ALLOW_MOCK_PAYMENT=true — disable before Customer #2"
        : !stripeEnabled
          ? "Stripe disabled — mock activation path is available"
          : "Mock payment mode disabled",
    ),
  ];

  if (!publishable || !secret) {
    checks[0] = check(
      "stripe-configured",
      "Stripe keys configured",
      "red",
      !publishable
        ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing"
        : "STRIPE_SECRET_KEY missing",
    );
  }

  return sectionFromChecks("stripe", "Stripe", checks);
}

async function runStorageChecks(): Promise<ProductionHealthSection> {
  const serviceRole = isServiceRoleConfigured();
  let bucketExists = false;
  let bucketPrivate = false;
  let signedUrlWorks = false;
  let visitMediaBucketExists = false;
  let visitMediaBucketPrivate = false;
  let storageMessage: string | undefined;

  if (isSupabaseConfigured()) {
    const probe = await probeSignedAgreementsBucketPublic();
    bucketPrivate = probe === "private";

    if (serviceRole) {
      try {
        const supabase = createServiceRoleSupabaseClient();
        const { data: bucket, error: bucketError } = await supabase.storage.getBucket(
          SIGNED_AGREEMENT_BUCKET,
        );
        if (!bucketError && bucket) {
          bucketExists = true;
          bucketPrivate = !bucket.public;
        } else if (bucketError) {
          storageMessage = bucketError.message;
        }

        const { data: visitBucket, error: visitBucketError } =
          await supabase.storage.getBucket(VISIT_MEDIA_BUCKET);
        if (!visitBucketError && visitBucket) {
          visitMediaBucketExists = true;
          visitMediaBucketPrivate = !visitBucket.public;
        } else if (visitBucketError && !storageMessage) {
          storageMessage = visitBucketError.message;
        }

        const signed = await resolveAgreementPdfAccessUrl(
          `storage:${SIGNED_AGREEMENT_BUCKET}/.production-health-probe.pdf`,
        );
        signedUrlWorks = Boolean(signed);
      } catch (error) {
        storageMessage =
          error instanceof Error ? error.message : "Storage check failed";
      }
    }
  }

  const checks: ProductionHealthCheck[] = [
    check(
      "storage-bucket",
      "signed-agreements bucket",
      bucketExists ? "green" : "red",
      bucketExists
        ? `${SIGNED_AGREEMENT_BUCKET} bucket reachable`
        : (storageMessage ?? "Bucket missing or inaccessible"),
    ),
    check(
      "storage-private",
      "Bucket is private",
      bucketPrivate ? "green" : bucketExists ? "red" : "yellow",
      bucketPrivate
        ? "Bucket is not world-readable"
        : "Bucket may be public — run migration 017",
    ),
    check(
      "storage-service-role",
      "Service role configured",
      serviceRole ? "green" : "red",
      serviceRole
        ? "SUPABASE_SERVICE_ROLE_KEY present server-side"
        : "Service role key missing — signed URLs will fail",
    ),
    check(
      "storage-signed-url",
      "Signed PDF access",
      signedUrlWorks ? "green" : serviceRole ? "yellow" : "red",
      signedUrlWorks
        ? "Signed URL generation works"
        : serviceRole
          ? "Signed URL generation unavailable"
          : "Requires service role",
    ),
    check(
      "storage-visit-media",
      "Private visit-photo storage",
      visitMediaBucketExists && visitMediaBucketPrivate ? "green" : "red",
      visitMediaBucketExists
        ? visitMediaBucketPrivate
          ? `${VISIT_MEDIA_BUCKET} bucket is private and reachable`
          : `${VISIT_MEDIA_BUCKET} must not be public`
        : `${VISIT_MEDIA_BUCKET} missing — apply migration 054`,
    ),
  ];

  return sectionFromChecks("storage", "Supabase Storage", checks);
}

async function runAgreementChecks(
  supabase: SupabaseClient,
): Promise<ProductionHealthSection> {
  const signatureColumn = await probeTableColumn(
    supabase,
    "signed_agreements",
    "signature_image_storage_path",
  );
  const pdfColumn = await probeTableColumn(
    supabase,
    "signed_agreements",
    "agreement_pdf_url",
  );

  let storageFormatStatus: ProductionHealthStatus = "yellow";
  let storageFormatMessage = "No signed agreements yet";
  const { data: latestAgreement } = await supabase
    .from("signed_agreements")
    .select("agreement_pdf_url, signature_image_storage_path")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestAgreement?.agreement_pdf_url) {
    const pdfRef = latestAgreement.agreement_pdf_url as string;
    if (
      isSignedAgreementStorageRef(pdfRef) ||
      pdfRef.startsWith("https://") ||
      pdfRef.startsWith("data:")
    ) {
      storageFormatStatus = "green";
      storageFormatMessage = "Latest agreement uses supported PDF storage format";
    } else {
      storageFormatStatus = "yellow";
      storageFormatMessage = "Latest agreement PDF reference may need migration";
    }
  }

  const signedUrlAvailable = isServiceRoleConfigured();
  const checks: ProductionHealthCheck[] = [
    schemaCheck(
      "agreement-signature-column",
      "Signature storage column",
      signatureColumn,
    ),
    schemaCheck("agreement-pdf-column", "Agreement PDF column", pdfColumn),
    check(
      "agreement-storage-format",
      "PDF storage path format",
      storageFormatStatus,
      storageFormatMessage,
    ),
    check(
      "agreement-signed-url",
      "Signed URL generation",
      signedUrlAvailable ? "green" : "red",
      signedUrlAvailable
        ? "resolveAgreementPdfAccessUrl available server-side"
        : "Service role required for private PDF access",
    ),
  ];

  return sectionFromChecks("agreement", "Agreement signing", checks);
}

async function runSalesBillingChecks(
  supabase: SupabaseClient,
): Promise<ProductionHealthSection> {
  const salesTable = await probeTableColumn(supabase, "website_membership_sales");
  const billingTable = await probeTableColumn(
    supabase,
    "membership_billing_charges",
  );

  const { data: activeMemberships, error } = await supabase
    .from("memberships")
    .select(
      "id, stripe_customer_id, stripe_payment_method_id, visit_price, membership_enrollment_savings, sales_tier",
    )
    .eq("status", "active");

  if (error && !error.message.includes("membership_enrollment_savings")) {
    throw new Error(error.message);
  }

  let memberships = activeMemberships ?? [];
  if (error?.message.includes("membership_enrollment_savings")) {
    const fallback = await supabase
      .from("memberships")
      .select(
        "id, stripe_customer_id, stripe_payment_method_id, visit_price, sales_tier",
      )
      .eq("status", "active");
    if (fallback.error) throw new Error(fallback.error.message);
    memberships = (fallback.data ?? []).map((row) => ({
      ...row,
      membership_enrollment_savings: null,
    }));
  }

  const missingStripe = memberships.filter(
    (row) => !row.stripe_customer_id || !row.stripe_payment_method_id,
  );
  const missingVisitPrice = memberships.filter(
    (row) => row.visit_price == null || Number(row.visit_price) <= 0,
  );
  const missingEnrollment = memberships.filter(
    (row) => row.membership_enrollment_savings == null,
  );

  const checks: ProductionHealthCheck[] = [
    schemaCheck("sales-table", "Website sales table", salesTable),
    schemaCheck("billing-table", "Billing charges table", billingTable),
    check(
      "sales-missing-stripe",
      "Active memberships missing Stripe IDs",
      missingStripe.length === 0 ? "green" : "yellow",
      missingStripe.length === 0
        ? "All active memberships have Stripe customer + payment method"
        : `${missingStripe.length} active membership(s) missing Stripe IDs`,
    ),
    check(
      "sales-missing-visit-price",
      "Active memberships missing visit price",
      missingVisitPrice.length === 0 ? "green" : "red",
      missingVisitPrice.length === 0
        ? "All active memberships have visit pricing"
        : `${missingVisitPrice.length} active membership(s) missing visit_price`,
    ),
    check(
      "sales-missing-enrollment-savings",
      "Active memberships missing enrollment savings",
      missingEnrollment.length === 0
        ? "green"
        : salesTable.ok
          ? "yellow"
          : "red",
      missingEnrollment.length === 0
        ? "Enrollment savings locked on all active memberships"
        : `${missingEnrollment.length} active membership(s) missing membership_enrollment_savings`,
    ),
  ];

  return sectionFromChecks("sales-billing", "Sales / Billing readiness", checks);
}

function tiersDisagree(
  membershipTier: string | null,
  presentationTier: string | null,
  agreementPlan: string | null,
): boolean {
  const expected = membershipTier
    ? normalizeToSqueegeeKingTier(membershipTier)
    : null;
  if (!expected) return false;

  const presentationNormalized = presentationTier
    ? normalizeToSqueegeeKingTier(presentationTier)
    : null;
  const agreementNormalized = agreementPlan
    ? normalizeToSqueegeeKingTier(agreementPlan)
    : null;

  if (presentationNormalized && presentationNormalized !== expected) {
    return true;
  }
  if (agreementNormalized && agreementNormalized !== expected) {
    return true;
  }
  return false;
}

async function runIntegrityChecks(
  supabase: SupabaseClient,
): Promise<ProductionHealthSection> {
  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, property_id, homeowner_id, status, sales_tier, visit_price, payment_setup_completed_at, stripe_payment_method_id, presentation_id, agreement_id",
    )
    .in("status", ["active", "pending_payment"]);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const rows = memberships ?? [];
  const activeRows = rows.filter((row) =>
    isMembershipActive(row as { status: string; payment_setup_completed_at: string | null }),
  );
  const membershipIds = rows.map((row) => row.id as string);
  const presentationIds = [
    ...new Set(
      rows
        .map((row) => row.presentation_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const agreementIds = [
    ...new Set(
      rows
        .map((row) => row.agreement_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [presentationsRes, agreementsRes, obligationsRes, salesRes] =
    await Promise.all([
      presentationIds.length > 0
        ? supabase
            .from("presentations")
            .select("id, tier")
            .in("id", presentationIds)
        : Promise.resolve({ data: [], error: null }),
      agreementIds.length > 0
        ? supabase
            .from("signed_agreements")
            .select("id, plan_name")
            .in("id", agreementIds)
        : Promise.resolve({ data: [], error: null }),
      membershipIds.length > 0
        ? supabase
            .from("obligations")
            .select("membership_id")
            .in("membership_id", membershipIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("website_membership_sales").select("membership_id"),
    ]);

  if (presentationsRes.error && !presentationsRes.error.message.includes("does not exist")) {
    throw new Error(presentationsRes.error.message);
  }
  if (agreementsRes.error) throw new Error(agreementsRes.error.message);
  if (obligationsRes.error && !obligationsRes.error.message.includes("does not exist")) {
    throw new Error(obligationsRes.error.message);
  }

  const presentationById = new Map(
    ((presentationsRes.data ?? []) as Array<{ id: string; tier: string }>).map(
      (row) => [row.id, row.tier],
    ),
  );
  const agreementById = new Map(
    ((agreementsRes.data ?? []) as Array<{ id: string; plan_name: string }>).map(
      (row) => [row.id, row.plan_name],
    ),
  );
  const obligationCounts = new Map<string, number>();
  for (const row of (obligationsRes.data ?? []) as Array<{
    membership_id: string;
  }>) {
    obligationCounts.set(
      row.membership_id,
      (obligationCounts.get(row.membership_id) ?? 0) + 1,
    );
  }

  const tierMismatches = activeRows.filter((row) =>
    tiersDisagree(
      row.sales_tier as string | null,
      row.presentation_id
        ? (presentationById.get(row.presentation_id as string) ?? null)
        : null,
      row.agreement_id
        ? (agreementById.get(row.agreement_id as string) ?? null)
        : null,
    ),
  );

  const missingCard = activeRows.filter(
    (row) =>
      !row.payment_setup_completed_at || !row.stripe_payment_method_id,
  );
  const zeroObligations = activeRows.filter(
    (row) => (obligationCounts.get(row.id as string) ?? 0) === 0,
  );

  const membershipsByProperty = new Map<string, number>();
  for (const row of rows.filter((membership) =>
    ["pending_checkout", "pending_payment", "active", "paused"].includes(
      membership.status as string,
    ),
  )) {
    const propertyId = row.property_id as string;
    membershipsByProperty.set(
      propertyId,
      (membershipsByProperty.get(propertyId) ?? 0) + 1,
    );
  }
  const duplicateMemberships = [...membershipsByProperty.values()].filter(
    (count) => count > 1,
  ).length;

  const salesCounts = new Map<string, number>();
  if (!salesRes.error) {
    for (const row of (salesRes.data ?? []) as Array<{ membership_id: string }>) {
      salesCounts.set(
        row.membership_id,
        (salesCounts.get(row.membership_id) ?? 0) + 1,
      );
    }
  }
  const duplicateSales = [...salesCounts.values()].filter((count) => count > 1).length;

  const checks: ProductionHealthCheck[] = [
    check(
      "integrity-tier-alignment",
      "Tier alignment (membership / presentation / agreement)",
      tierMismatches.length === 0 ? "green" : "red",
      tierMismatches.length === 0
        ? "Active memberships agree across presentation and agreement"
        : `${tierMismatches.length} active membership(s) have tier disagreements`,
    ),
    check(
      "integrity-card-on-file",
      "Active memberships with card on file",
      missingCard.length === 0 ? "green" : "red",
      missingCard.length === 0
        ? "All active memberships have payment setup completed"
        : `${missingCard.length} active membership(s) missing card on file`,
    ),
    check(
      "integrity-obligations",
      "Active memberships with obligations",
      zeroObligations.length === 0 ? "green" : "yellow",
      zeroObligations.length === 0
        ? "All active memberships have obligation windows"
        : `${zeroObligations.length} active membership(s) have zero obligations`,
    ),
    check(
      "integrity-duplicate-memberships",
      "Concurrent memberships per property",
      duplicateMemberships === 0 ? "green" : "red",
      duplicateMemberships === 0
        ? "At most one current membership per property; history is preserved"
        : `${duplicateMemberships} property/properties have multiple current memberships`,
    ),
    check(
      "integrity-duplicate-sales",
      "Duplicate website sales rows",
      duplicateSales === 0 ? "green" : salesRes.error ? "yellow" : "red",
      salesRes.error
        ? "Website sales table unavailable"
        : duplicateSales === 0
          ? "No duplicate website_membership_sales rows"
          : `${duplicateSales} membership(s) have duplicate sales rows`,
    ),
  ];

  return sectionFromChecks(
    "integrity",
    "Customer data integrity",
    checks,
  );
}

export function resolveOnboardingSafe(
  sections: ProductionHealthSection[],
): { status: ProductionHealthStatus; summary: string } {
  const onboardingSections = sections.filter((section) =>
    ONBOARDING_CRITICAL_SECTIONS.has(section.id),
  );
  const blockers = onboardingSections
    .filter((section) => section.status === "red")
    .map((section) => ONBOARDING_CRITICAL_SECTIONS.get(section.id)!);

  if (blockers.length > 0) {
    return {
      status: "red",
      summary: `Do not onboard Customer #2 — ${blockers.join(", ")}.`,
    };
  }

  const reviewSections = onboardingSections.filter(
    (section) => section.status === "yellow",
  );
  if (reviewSections.length > 0) {
    return {
      status: "yellow",
      summary: `Manual review recommended before onboarding — ${reviewSections
        .map((section) => section.title.toLowerCase())
        .join(", ")}.`,
    };
  }

  return {
    status: "green",
    summary: "Production is ready for live customer onboarding.",
  };
}

export async function runProductionHealthReport(): Promise<ProductionHealthReport> {
  if (!isSupabaseConfigured()) {
    const sections: ProductionHealthSection[] = [
      sectionFromChecks("schema", "Database migrations / schema", [
        check(
          "schema-supabase",
          "Supabase configured",
          "red",
          "NEXT_PUBLIC_SUPABASE_URL or ANON_KEY missing",
        ),
      ]),
      runStripeChecks(),
      sectionFromChecks("storage", "Supabase Storage", [
        check(
          "storage-supabase",
          "Supabase configured",
          "red",
          "Storage checks require Supabase",
        ),
      ]),
      sectionFromChecks("agreement", "Agreement signing", [
        check(
          "agreement-supabase",
          "Supabase configured",
          "red",
          "Agreement checks require Supabase",
        ),
      ]),
      sectionFromChecks("sales-billing", "Sales / Billing readiness", [
        check(
          "sales-supabase",
          "Supabase configured",
          "red",
          "Sales checks require Supabase",
        ),
      ]),
      sectionFromChecks("integrity", "Customer data integrity", [
        check(
          "integrity-supabase",
          "Supabase configured",
          "red",
          "Integrity checks require Supabase",
        ),
      ]),
      sectionFromChecks("privacy", "Customer data privacy", [
        check(
          "privacy-supabase",
          "Supabase configured",
          "red",
          "Privacy checks require Supabase",
        ),
      ]),
      await runIntegrationAutomationChecks(),
    ];
    const onboarding = resolveOnboardingSafe(sections);
    return {
      onboardingSafe: onboarding.status,
      summary: onboarding.summary,
      sections,
      checkedAt: new Date().toISOString(),
    };
  }

  const supabase = createServerSupabaseClient();
  const sections = await Promise.all([
    runSchemaChecks(supabase),
    runCustomerPrivacyChecks(supabase),
    Promise.resolve(runStripeChecks()),
    runStorageChecks(),
    runAgreementChecks(supabase),
    runSalesBillingChecks(supabase),
    runIntegrityChecks(supabase),
    runIntegrationAutomationChecks(),
  ]);

  if (!isCloudPersistenceConnected()) {
    sections.push(
      sectionFromChecks("persistence", "Cloud persistence", [
        check(
          "persistence-cloud",
          "Cloud persistence enabled",
          "yellow",
          "NEXT_PUBLIC_SUPABASE_ENABLED is not true",
        ),
      ]),
    );
  }

  const onboarding = resolveOnboardingSafe(sections);
  return {
    onboardingSafe: onboarding.status,
    summary: onboarding.summary,
    sections,
    checkedAt: new Date().toISOString(),
  };
}

export { tiersDisagree, worstStatus };
