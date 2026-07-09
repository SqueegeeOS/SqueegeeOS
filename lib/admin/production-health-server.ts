import { allowsMockWebsiteMembershipSales } from "@/lib/admin/website-membership-sales";
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
import type { SupabaseClient } from "@supabase/supabase-js";

interface ColumnProbeResult {
  ok: boolean;
  missing: boolean;
  message: string;
}

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
  const probes = await Promise.all([
    probeTableColumn(supabase, "presentations", "enrollment_savings"),
    probeTableColumn(supabase, "memberships", "membership_enrollment_savings"),
    probeTableColumn(supabase, "website_membership_sales"),
    probeTableColumn(supabase, "membership_billing_charges"),
    probeTableColumn(supabase, "obligations"),
    probeTableColumn(supabase, "obligation_events"),
    probeTableColumn(
      supabase,
      "signed_agreements",
      "signature_image_storage_path",
    ),
    probeTableColumn(supabase, "signed_agreements", "agreement_pdf_url"),
  ]);

  const labels = [
    "presentations.enrollment_savings",
    "memberships.membership_enrollment_savings",
    "website_membership_sales",
    "membership_billing_charges",
    "obligations",
    "obligation_events",
    "signed_agreements.signature_image_storage_path",
    "signed_agreements.agreement_pdf_url",
  ];

  const checks = probes.map((probe, index) =>
    schemaCheck(`schema-${index}`, labels[index]!, probe),
  );

  return sectionFromChecks("schema", "Database migrations / schema", checks);
}

function runStripeChecks(): ProductionHealthSection {
  const publishable = Boolean(getStripePublishableKey());
  const secret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripeEnabled = isStripeServerEnabled();
  const keyMode = resolveStripeKeyMode();
  const liveMode = isStripeLiveMode();
  const mockEnabled = allowsMockWebsiteMembershipSales();
  const setupRouteReady = isSupabaseConfigured() && stripeEnabled;

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
  const activeRows = rows.filter((row) => row.status === "active");
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
  for (const row of rows) {
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
      "Duplicate memberships per property",
      duplicateMemberships === 0 ? "green" : "red",
      duplicateMemberships === 0
        ? "One membership row per property"
        : `${duplicateMemberships} property/properties have multiple memberships`,
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
  const schema = sections.find((section) => section.id === "schema");
  const stripe = sections.find((section) => section.id === "stripe");
  const integrity = sections.find((section) => section.id === "integrity");
  const storage = sections.find((section) => section.id === "storage");

  const blockers: string[] = [];
  if (schema?.status === "red") blockers.push("schema migrations incomplete");
  if (stripe?.status === "red") blockers.push("Stripe not production-ready");
  if (storage?.status === "red") blockers.push("agreement storage unsafe");
  if (integrity?.status === "red") blockers.push("customer data integrity issues");

  if (blockers.length > 0) {
    return {
      status: "red",
      summary: `Do not onboard Customer #2 — ${blockers.join(", ")}.`,
    };
  }

  const reviewSections = sections.filter((section) => section.status === "yellow");
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
    Promise.resolve(runStripeChecks()),
    runStorageChecks(),
    runAgreementChecks(supabase),
    runSalesBillingChecks(supabase),
    runIntegrityChecks(supabase),
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
