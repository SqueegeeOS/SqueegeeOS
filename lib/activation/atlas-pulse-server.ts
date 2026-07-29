import "server-only";

import { loadMembershipCommandCenter } from "@/lib/admin/membership-command-center-server";
import type { MembershipMemberRow } from "@/lib/admin/membership-command-center-types";
import {
  getJobberConfigStatus,
  JOBBER_CONNECTION_ID,
} from "@/lib/care-operations/jobber-oauth-config";
import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import {
  loadJobberCustomerMatchingWorkspace,
  searchHomeAtlasCustomers,
} from "@/lib/care-operations/jobber-customer-matching";
import { isGoogleBusinessOAuthConfigured } from "@/lib/reviews/google-oauth-config";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { isStripeLiveMode } from "@/lib/stripe/mode";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  buildCareOpportunities,
  buildExceptionCodes,
  buildJourneyActions,
  buildJourneyStages,
  journeyCompletionPercent,
  scoreCustomerMatch,
} from "./atlas-pulse-model";
import type {
  AtlasPulseCustomer,
  AtlasPulseDashboard,
  AtlasPulseIntegration,
  AtlasPulseMatchSuggestion,
  AtlasPulseUniversalSearchResult,
} from "./atlas-pulse-types";

interface HomeownerContactRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  updated_at: string | null;
}

interface PropertySearchRow {
  homeowner_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface PresentationJourneyRow {
  id: string;
  homeowner_id: string | null;
  membership_id: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string;
  tier: string;
  status: string;
  signed_at: string | null;
  agreement_id: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadJourneyRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  service_address: string;
  membership_tier: string | null;
  status: string;
  submitted_at: string;
}

interface JobberCustomerLinkRow {
  external_client_id: string;
  homeowner_id: string;
  updated_at: string;
}

interface JobberClientRow {
  external_client_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobber_web_uri: string;
  properties: Array<{ name?: string | null }> | null;
  last_seen_at: string;
}

interface CommunicationRow {
  membership_id: string;
  status: string;
  sent_at: string | null;
  provider_event_at: string | null;
  updated_at: string;
}

interface AddonRow {
  membership_id: string;
  service_name: string;
}

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.message ?? "").toLowerCase().includes("does not exist") ||
    (error.message ?? "").toLowerCase().includes("schema cache")
  );
}

function propertySearchLabel(property: PropertySearchRow): string {
  return [
    property.name,
    property.address,
    property.city,
    property.state,
    property.zip,
  ]
    .filter(Boolean)
    .join(" · ");
}

function nextActionLabel(stages: ReturnType<typeof buildJourneyStages>): string {
  const next = stages.find((stage) => stage.status === "attention");
  return next?.detail ?? "Journey complete";
}

function paymentReady(member: MembershipMemberRow): boolean {
  return member.paymentStatus === "card_on_file";
}

function integration(
  id: AtlasPulseIntegration["id"],
  label: string,
  status: AtlasPulseIntegration["status"],
  message: string,
  detail?: string | null,
): AtlasPulseIntegration {
  return { id, label, status, message, detail };
}

async function loadIntegrations(input: {
  supabaseReachable: boolean;
  latestJobberWebhookAt: string | null;
  jobberWebhookTableReady: boolean;
  latestCommunicationAt: string | null;
  communicationsTableReady: boolean;
}): Promise<AtlasPulseIntegration[]> {
  const jobberConfig = getJobberConfigStatus();
  let jobberConnected = false;
  let jobberDetail: string | null = null;
  if (jobberConfig.configured) {
    try {
      const connection = await readJobberConnectionStatus();
      jobberConnected = connection.connected;
      jobberDetail = connection.accountName;
    } catch {
      jobberDetail = "Connection state is unavailable";
    }
  }

  const stripeConfigured = isStripeServerEnabled();
  const stripeLive = isStripeLiveMode();
  const resendConfigured = Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.RESEND_AGREEMENT_FROM?.trim(),
  );
  const resendWebhookConfigured = Boolean(
    process.env.RESEND_WEBHOOK_SECRET?.trim(),
  );
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null;

  return [
    integration(
      "supabase",
      "Supabase",
      input.supabaseReachable ? "healthy" : "offline",
      input.supabaseReachable ? "Customer data reachable" : "Database unavailable",
    ),
    integration(
      "jobber",
      "Jobber",
      jobberConnected
        ? input.jobberWebhookTableReady && input.latestJobberWebhookAt
          ? "healthy"
          : "attention"
        : "offline",
      jobberConnected
        ? input.latestJobberWebhookAt
          ? "Connected and receiving events"
          : "Connected; webhook heartbeat not seen yet"
        : jobberConfig.configured
          ? "Authorization needs attention"
          : "OAuth environment is incomplete",
      jobberDetail,
    ),
    integration(
      "stripe",
      "Stripe",
      stripeConfigured && stripeLive
        ? "healthy"
        : stripeConfigured
          ? "attention"
          : "offline",
      stripeConfigured && stripeLive
        ? "Live card setup ready"
        : stripeConfigured
          ? "Configured, but not live mode"
          : "Stripe keys are incomplete",
    ),
    integration(
      "resend",
      "Resend",
      resendConfigured && resendWebhookConfigured && input.communicationsTableReady
        ? "healthy"
        : resendConfigured
          ? "attention"
          : "offline",
      !resendConfigured
        ? "Sending configuration is incomplete"
        : !input.communicationsTableReady
          ? "Migration 036 is required for delivery tracking"
          : !resendWebhookConfigured
            ? "Sending works; delivery webhook is not configured"
            : input.latestCommunicationAt
              ? "Sending and delivery tracking ready"
              : "Ready; no welcome delivery recorded yet",
    ),
    integration(
      "reviews",
      "Google Reviews",
      isGoogleBusinessOAuthConfigured() ? "healthy" : "attention",
      isGoogleBusinessOAuthConfigured()
        ? "Business Profile OAuth configured"
        : "OAuth environment is incomplete",
    ),
    integration(
      "deployment",
      "Deployment",
      process.env.VERCEL === "1" ? "healthy" : "attention",
      process.env.VERCEL === "1"
        ? "Running on Vercel production infrastructure"
        : "Running outside Vercel",
      deploymentSha ? `Commit ${deploymentSha.slice(0, 7)}` : null,
    ),
  ];
}

function emptyDashboard(): AtlasPulseDashboard {
  const loadedAt = new Date().toISOString();
  return {
    connected: false,
    loadedAt,
    summary: {
      totalJourneys: 0,
      completedJourneys: 0,
      needsAttention: 0,
      unpairedJobber: 0,
      unscheduledMembers: 0,
      revenueRadar: 0,
    },
    customers: [],
    matchSuggestions: [],
    integrations: [
      integration(
        "supabase",
        "Supabase",
        "offline",
        "Supabase is not configured",
      ),
      integration("jobber", "Jobber", "offline", "Supabase is required"),
      integration("stripe", "Stripe", "attention", "Status unavailable"),
      integration("resend", "Resend", "attention", "Status unavailable"),
      integration("reviews", "Google Reviews", "attention", "Status unavailable"),
      integration("deployment", "Deployment", "attention", "Status unavailable"),
    ],
    dataNotes: ["Connect Supabase to activate Atlas Pulse."],
  };
}

export async function loadAtlasPulseDashboard(): Promise<AtlasPulseDashboard> {
  if (!isSupabaseConfigured()) return emptyDashboard();

  const loadedAt = new Date().toISOString();
  const dataNotes: string[] = [];
  const supabase = createServerSupabaseClient();
  const membershipWorkspace = await loadMembershipCommandCenter();
  const memberRows = [
    ...membershipWorkspace.activeMembers,
    ...membershipWorkspace.pendingMembers,
  ];
  const homeownerIds = [
    ...new Set(memberRows.map((row) => row.homeownerId).filter(Boolean)),
  ];
  const membershipIds = memberRows
    .map((row) => row.membershipId)
    .filter((id): id is string => Boolean(id));

  const [
    homeownersResult,
    allHomeownersResult,
    propertiesResult,
    presentationsResult,
    leadsResult,
    linksResult,
    clientsResult,
    communicationsResult,
    addonsResult,
    clientCountResult,
    webhookResult,
  ] = await Promise.all([
    homeownerIds.length
      ? supabase
          .from("homeowners")
          .select("id, full_name, email, phone, updated_at")
          .in("id", homeownerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("homeowners")
      .select("id, full_name, email, phone, updated_at")
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase
      .from("properties")
      .select("homeowner_id, name, address, city, state, zip")
      .limit(1000),
    supabase
      .from("presentations")
      .select(
        "id, homeowner_id, membership_id, client_name, client_email, client_address, tier, status, signed_at, agreement_id, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("lead_intakes")
      .select(
        "id, name, phone, email, service_address, membership_tier, status, submitted_at",
      )
      .in("status", ["new", "contacted", "scheduled"])
      .order("submitted_at", { ascending: false })
      .limit(250),
    supabase
      .from("jobber_customer_links")
      .select("external_client_id, homeowner_id, updated_at")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("link_state", "active")
      .limit(1000),
    supabase
      .from("jobber_client_projections")
      .select(
        "external_client_id, name, email, phone, jobber_web_uri, properties, last_seen_at",
      )
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("is_archived", false)
      .order("last_seen_at", { ascending: false })
      .limit(500),
    membershipIds.length
      ? supabase
          .from("membership_communications")
          .select(
            "membership_id, status, sent_at, provider_event_at, updated_at",
          )
          .eq("communication_type", "welcome_email")
          .in("membership_id", membershipIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    membershipIds.length
      ? supabase
          .from("member_addon_transactions")
          .select("membership_id, service_name")
          .in("membership_id", membershipIds)
          .in("status", ["scheduled", "completed", "paid"])
          .gte(
            "service_date",
            new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
          )
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("jobber_client_projections")
      .select("id", { count: "exact", head: true })
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("is_archived", false),
    supabase
      .from("jobber_webhook_events")
      .select("received_at, status")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (homeownersResult.error) throw new Error(homeownersResult.error.message);
  if (allHomeownersResult.error) throw new Error(allHomeownersResult.error.message);
  if (propertiesResult.error) throw new Error(propertiesResult.error.message);
  if (presentationsResult.error) throw new Error(presentationsResult.error.message);
  if (leadsResult.error) throw new Error(leadsResult.error.message);
  if (addonsResult.error && !missingRelation(addonsResult.error)) {
    dataNotes.push("Recent add-on history could not be loaded.");
  }

  const jobberTablesReady =
    !linksResult.error && !clientsResult.error && !clientCountResult.error;
  if (!jobberTablesReady) {
    dataNotes.push(
      missingRelation(linksResult.error) || missingRelation(clientsResult.error)
        ? "Run migration 035 to activate the complete Jobber index and pairing."
        : "Jobber projections are temporarily unavailable.",
    );
  }
  const communicationsTableReady = !communicationsResult.error;
  if (!communicationsTableReady) {
    dataNotes.push(
      missingRelation(communicationsResult.error)
        ? "Run migration 036 to activate welcome-email delivery tracking."
        : "Welcome-email delivery history is temporarily unavailable.",
    );
  }
  const jobberWebhookTableReady = !webhookResult.error;
  if (!jobberWebhookTableReady && missingRelation(webhookResult.error)) {
    dataNotes.push("Run migration 036 to activate Jobber webhook history.");
  }

  const homeowners = (homeownersResult.data ?? []) as HomeownerContactRow[];
  const allHomeowners = (allHomeownersResult.data ?? []) as HomeownerContactRow[];
  const properties = (propertiesResult.data ?? []) as PropertySearchRow[];
  const presentations = (presentationsResult.data ?? []) as PresentationJourneyRow[];
  const leads = (leadsResult.data ?? []) as LeadJourneyRow[];
  const links = jobberTablesReady
    ? ((linksResult.data ?? []) as JobberCustomerLinkRow[])
    : [];
  const clients = jobberTablesReady
    ? ((clientsResult.data ?? []) as JobberClientRow[])
    : [];
  const communications = communicationsTableReady
    ? ((communicationsResult.data ?? []) as CommunicationRow[])
    : [];
  const addons = !addonsResult.error
    ? ((addonsResult.data ?? []) as AddonRow[])
    : [];

  const homeownerById = new Map(homeowners.map((row) => [row.id, row]));
  const propertiesByHomeowner = new Map<string, string[]>();
  for (const property of properties) {
    const list = propertiesByHomeowner.get(property.homeowner_id) ?? [];
    list.push(propertySearchLabel(property));
    propertiesByHomeowner.set(property.homeowner_id, list);
  }
  const presentationById = new Map(presentations.map((row) => [row.id, row]));
  const linkByHomeowner = new Map(links.map((row) => [row.homeowner_id, row]));
  const clientByExternalId = new Map(
    clients.map((row) => [row.external_client_id, row]),
  );
  const communicationByMembership = new Map<string, CommunicationRow>();
  for (const row of communications) {
    if (!communicationByMembership.has(row.membership_id)) {
      communicationByMembership.set(row.membership_id, row);
    }
  }
  const addonsByMembership = new Map<string, string[]>();
  for (const row of addons) {
    const list = addonsByMembership.get(row.membership_id) ?? [];
    list.push(row.service_name);
    addonsByMembership.set(row.membership_id, list);
  }

  const linkedExternalIds = new Set(links.map((row) => row.external_client_id));
  const unpairedClients = clients.filter(
    (client) => !linkedExternalIds.has(client.external_client_id),
  );
  const matchSuggestions: AtlasPulseMatchSuggestion[] = [];
  for (const client of unpairedClients.slice(0, 100)) {
    let best: AtlasPulseMatchSuggestion | null = null;
    for (const homeowner of allHomeowners) {
      if (linkByHomeowner.has(homeowner.id)) continue;
      const match = scoreCustomerMatch(
        {
          name: client.name,
          email: client.email,
          phone: client.phone,
          properties: (client.properties ?? [])
            .map((property) => property.name ?? "")
            .filter(Boolean),
        },
        {
          name: homeowner.full_name,
          email: homeowner.email,
          phone: homeowner.phone,
          properties: propertiesByHomeowner.get(homeowner.id) ?? [],
        },
      );
      if (!match || (best && best.score >= match.score)) continue;
      best = {
        externalClientId: client.external_client_id,
        jobberName: client.name,
        homeownerId: homeowner.id,
        homeownerName: homeowner.full_name,
        ...match,
      };
    }
    if (best) matchSuggestions.push(best);
  }
  matchSuggestions.sort((a, b) => b.score - a.score);
  const suggestionByHomeowner = new Map(
    matchSuggestions.map((suggestion) => [suggestion.homeownerId, suggestion]),
  );

  const customers: AtlasPulseCustomer[] = [];
  const usedPresentationIds = new Set<string>();
  const currentMonth = new Date().getUTCMonth() + 1;

  for (const member of memberRows) {
    const contact = homeownerById.get(member.homeownerId) ?? null;
    const presentation = member.presentationId
      ? presentationById.get(member.presentationId) ?? null
      : null;
    const link = linkByHomeowner.get(member.homeownerId) ?? null;
    const jobberClient = link
      ? clientByExternalId.get(link.external_client_id) ?? null
      : null;
    const communication = member.membershipId
      ? communicationByMembership.get(member.membershipId) ?? null
      : null;
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: Boolean(member.presentationId),
      hasAgreement: Boolean(member.agreementId),
      paymentReady: paymentReady(member),
      portalUrl: member.portalUrl,
      welcomeDeliveryStatus: communication?.status ?? null,
      jobberLinked: Boolean(link),
      visitScheduled: Boolean(member.nextServiceLabel),
    });
    const actions = buildJourneyActions({
      membershipId: member.membershipId,
      presentationId: member.presentationId,
      homeownerId: member.homeownerId,
      portalUrl: member.portalUrl,
      paymentReady: paymentReady(member),
      hasAgreement: Boolean(member.agreementId),
      jobberLinked: Boolean(link),
      jobberWebUri: jobberClient?.jobber_web_uri ?? null,
      visitScheduled: Boolean(member.nextServiceLabel),
    });
    customers.push({
      recordKey: member.membershipId
        ? `membership:${member.membershipId}`
        : `presentation:${member.presentationId ?? member.homeownerId}`,
      source: member.membershipId ? "membership" : "presentation",
      homeownerId: member.homeownerId,
      membershipId: member.membershipId,
      presentationId: member.presentationId,
      leadId: null,
      homeownerName: member.homeownerName,
      email: contact?.email ?? presentation?.client_email ?? null,
      phone: contact?.phone ?? null,
      propertyLabel: member.propertyLabel,
      planType: member.planType,
      yearlyValue: member.yearlyValue,
      stages,
      completionPercent: journeyCompletionPercent(stages),
      exceptionCodes: buildExceptionCodes(stages),
      nextActionLabel: nextActionLabel(stages),
      actions,
      portalUrl: member.portalUrl,
      welcomeDeliveryStatus: communication?.status ?? null,
      welcomeDeliveryAt:
        communication?.provider_event_at ?? communication?.sent_at ?? null,
      jobber: {
        linked: Boolean(link),
        externalClientId: link?.external_client_id ?? null,
        clientName: jobberClient?.name ?? null,
        webUri: jobberClient?.jobber_web_uri ?? null,
        suggestedMatch: suggestionByHomeowner.get(member.homeownerId) ?? null,
      },
      nextServiceLabel: member.nextServiceLabel,
      opportunities: member.membershipId
        ? buildCareOpportunities({
            month: currentMonth,
            recentServiceNames:
              addonsByMembership.get(member.membershipId) ?? [],
          })
        : [],
      updatedAt:
        communication?.updated_at ?? presentation?.updated_at ?? contact?.updated_at ?? null,
    });
    if (member.presentationId) usedPresentationIds.add(member.presentationId);
  }

  for (const presentation of presentations) {
    if (usedPresentationIds.has(presentation.id) || presentation.membership_id) {
      continue;
    }
    const hasAgreement = Boolean(
      presentation.agreement_id || presentation.signed_at || presentation.status === "signed",
    );
    const link = presentation.homeowner_id
      ? linkByHomeowner.get(presentation.homeowner_id) ?? null
      : null;
    const jobberClient = link
      ? clientByExternalId.get(link.external_client_id) ?? null
      : null;
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: true,
      hasAgreement,
      paymentReady: false,
      portalUrl: null,
      welcomeDeliveryStatus: null,
      jobberLinked: Boolean(link),
      visitScheduled: false,
    });
    customers.push({
      recordKey: `presentation:${presentation.id}`,
      source: "presentation",
      homeownerId: presentation.homeowner_id,
      membershipId: null,
      presentationId: presentation.id,
      leadId: null,
      homeownerName: presentation.client_name,
      email: presentation.client_email,
      phone: null,
      propertyLabel: presentation.client_address || "Address not captured",
      planType: presentation.tier,
      yearlyValue: null,
      stages,
      completionPercent: journeyCompletionPercent(stages),
      exceptionCodes: buildExceptionCodes(stages),
      nextActionLabel: nextActionLabel(stages),
      actions: buildJourneyActions({
        membershipId: null,
        presentationId: presentation.id,
        homeownerId: presentation.homeowner_id,
        portalUrl: null,
        paymentReady: false,
        hasAgreement,
        jobberLinked: Boolean(link),
        jobberWebUri: jobberClient?.jobber_web_uri ?? null,
        visitScheduled: false,
      }),
      portalUrl: null,
      welcomeDeliveryStatus: null,
      welcomeDeliveryAt: null,
      jobber: {
        linked: Boolean(link),
        externalClientId: link?.external_client_id ?? null,
        clientName: jobberClient?.name ?? null,
        webUri: jobberClient?.jobber_web_uri ?? null,
        suggestedMatch: presentation.homeowner_id
          ? suggestionByHomeowner.get(presentation.homeowner_id) ?? null
          : null,
      },
      nextServiceLabel: null,
      opportunities: [],
      updatedAt: presentation.updated_at,
    });
  }

  const normalizedJourneyEmails = new Set(
    customers.map((customer) => customer.email?.trim().toLowerCase()).filter(Boolean),
  );
  for (const lead of leads) {
    const email = lead.email?.trim().toLowerCase() ?? "";
    if (email && normalizedJourneyEmails.has(email)) continue;
    const stages = buildJourneyStages({
      hasLead: true,
      hasPresentation: false,
      hasAgreement: false,
      paymentReady: false,
      portalUrl: null,
      welcomeDeliveryStatus: null,
      jobberLinked: false,
      visitScheduled: false,
    });
    customers.push({
      recordKey: `lead:${lead.id}`,
      source: "lead",
      homeownerId: null,
      membershipId: null,
      presentationId: null,
      leadId: lead.id,
      homeownerName: lead.name,
      email: lead.email,
      phone: lead.phone,
      propertyLabel: lead.service_address,
      planType: lead.membership_tier ?? "Not selected",
      yearlyValue: null,
      stages,
      completionPercent: journeyCompletionPercent(stages),
      exceptionCodes: buildExceptionCodes(stages),
      nextActionLabel: "Create the presentation",
      actions: [
        {
          id: "open-lead",
          kind: "open_link",
          label: "Open lead",
          href: `/hq/requests/${encodeURIComponent(lead.id)}`,
          primary: true,
        },
        {
          id: "new-presentation",
          kind: "open_link",
          label: "New presentation",
          href: "/presentations/new",
        },
      ],
      portalUrl: null,
      welcomeDeliveryStatus: null,
      welcomeDeliveryAt: null,
      jobber: {
        linked: false,
        externalClientId: null,
        clientName: null,
        webUri: null,
        suggestedMatch: null,
      },
      nextServiceLabel: null,
      opportunities: [],
      updatedAt: lead.submitted_at,
    });
  }

  customers.sort((a, b) => {
    if (a.exceptionCodes.length !== b.exceptionCodes.length) {
      return b.exceptionCodes.length - a.exceptionCodes.length;
    }
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  });

  const latestCommunicationAt = communications[0]?.updated_at ?? null;
  const latestJobberWebhookAt =
    (webhookResult.data?.received_at as string | null | undefined) ?? null;
  const integrations = await loadIntegrations({
    supabaseReachable: true,
    latestJobberWebhookAt,
    jobberWebhookTableReady,
    latestCommunicationAt,
    communicationsTableReady,
  });
  const totalJobberClients = jobberTablesReady ? clientCountResult.count ?? 0 : 0;
  const revenueRadar = customers.reduce(
    (sum, customer) =>
      sum +
      customer.opportunities.reduce(
        (customerSum, opportunity) => customerSum + (opportunity.amount ?? 0),
        0,
      ),
    0,
  );

  return {
    connected: true,
    loadedAt,
    summary: {
      totalJourneys: customers.length,
      completedJourneys: customers.filter(
        (customer) => customer.completionPercent === 100,
      ).length,
      needsAttention: customers.filter(
        (customer) => customer.exceptionCodes.length > 0,
      ).length,
      unpairedJobber: Math.max(0, totalJobberClients - links.length),
      unscheduledMembers: memberRows.filter(
        (member) => member.isActive && !member.nextServiceLabel,
      ).length,
      revenueRadar,
    },
    customers,
    matchSuggestions: matchSuggestions.slice(0, 12),
    integrations,
    dataNotes: [...new Set(dataNotes)],
  };
}

export async function loadAtlasPulseUniversalSearch(
  rawSearch: string,
): Promise<AtlasPulseUniversalSearchResult> {
  const search = rawSearch.trim().slice(0, 120);
  if (search.length < 2) {
    return { search, homeAtlas: [], jobber: [] };
  }

  const [homeAtlasResult, jobberResult] = await Promise.allSettled([
    searchHomeAtlasCustomers({ search, limit: 20 }),
    loadJobberCustomerMatchingWorkspace({ search, page: 1, pageSize: 20 }),
  ]);

  return {
    search,
    homeAtlas:
      homeAtlasResult.status === "fulfilled"
        ? homeAtlasResult.value.customers.map((customer) => ({
            homeownerId: customer.homeownerId,
            name: customer.fullName,
            email: customer.email,
            phone: customer.phone,
            properties: customer.properties.map((property) => property.label),
          }))
        : [],
    jobber:
      jobberResult.status === "fulfilled"
        ? jobberResult.value.clients.map((client) => ({
            externalClientId: client.externalClientId,
            name: client.name,
            email: client.email,
            phone: client.phone,
            webUri: client.jobberWebUri,
            linkedHomeownerName: client.customerLink?.homeownerName ?? null,
          }))
        : [],
  };
}
