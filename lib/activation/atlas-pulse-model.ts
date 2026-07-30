import type {
  AtlasPulseAction,
  AtlasPulseConfidence,
  AtlasPulseOpportunity,
  AtlasPulseStage,
  AtlasPulseStageId,
} from "./atlas-pulse-types";

const STAGE_LABELS: Record<AtlasPulseStageId, string> = {
  lead: "Lead",
  presentation: "Presentation",
  agreement: "Agreement",
  payment: "Payment",
  email: "Welcome email",
  portal: "Portal opened",
  jobber: "Jobber paired",
  scheduled: "Visit scheduled",
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

export interface CustomerMatchInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  properties?: string[];
}

export function scoreCustomerMatch(
  jobber: CustomerMatchInput,
  homeAtlas: CustomerMatchInput,
): { score: number; confidence: AtlasPulseConfidence; reasons: string[] } | null {
  let score = 0;
  const reasons: string[] = [];

  const jobberEmail = normalizeEmail(jobber.email);
  const atlasEmail = normalizeEmail(homeAtlas.email);
  if (jobberEmail && atlasEmail && jobberEmail === atlasEmail) {
    score += 55;
    reasons.push("same email");
  }

  const jobberPhone = normalizePhone(jobber.phone);
  const atlasPhone = normalizePhone(homeAtlas.phone);
  if (
    jobberPhone.length >= 7 &&
    atlasPhone.length >= 7 &&
    jobberPhone === atlasPhone
  ) {
    score += 35;
    reasons.push("same phone");
  }

  const nameOverlap = tokenOverlap(jobber.name, homeAtlas.name);
  if (nameOverlap === 1) {
    score += 25;
    reasons.push("same name");
  } else if (nameOverlap >= 0.5) {
    score += 15;
    reasons.push("similar name");
  }

  const jobberProperties = jobber.properties ?? [];
  const atlasProperties = homeAtlas.properties ?? [];
  const propertyOverlap = jobberProperties.some((jobberProperty) =>
    atlasProperties.some(
      (atlasProperty) => tokenOverlap(jobberProperty, atlasProperty) >= 0.5,
    ),
  );
  if (propertyOverlap) {
    score += 20;
    reasons.push("same property");
  }

  if (score < 25) return null;
  const confidence: AtlasPulseConfidence =
    score >= 70 ? "high" : score >= 45 ? "likely" : "possible";
  return { score: Math.min(score, 100), confidence, reasons };
}

export interface JourneyStageInput {
  hasLead: boolean;
  hasPresentation: boolean;
  hasAgreement: boolean;
  paymentReady: boolean;
  portalUrl: string | null;
  welcomeDeliveryStatus: string | null;
  manualEmailComplete?: boolean;
  manualPortalComplete?: boolean;
  jobberLinked: boolean;
  visitScheduled: boolean;
}

export function buildJourneyStages(input: JourneyStageInput): AtlasPulseStage[] {
  const welcomeStatus = input.welcomeDeliveryStatus?.toLowerCase() ?? null;
  const deliveryComplete = ["delivered", "opened", "clicked"].includes(
    welcomeStatus ?? "",
  );
  const deliveryAccepted = ["accepted", "sent"].includes(welcomeStatus ?? "");
  const deliveryFailed = [
    "failed",
    "bounced",
    "complained",
    "skipped",
    "delivery_delayed",
  ].includes(welcomeStatus ?? "");

  return [
    {
      id: "lead",
      label: STAGE_LABELS.lead,
      status: input.hasLead ? "complete" : "waiting",
      detail: input.hasLead ? "Customer record exists" : "No lead record found",
    },
    {
      id: "presentation",
      label: STAGE_LABELS.presentation,
      status: input.hasPresentation
        ? "complete"
        : input.hasLead
          ? "attention"
          : "waiting",
      detail: input.hasPresentation
        ? "Presentation created"
        : input.hasLead
          ? "Create the presentation"
          : "Waiting for a lead",
    },
    {
      id: "agreement",
      label: STAGE_LABELS.agreement,
      status: input.hasAgreement
        ? "complete"
        : input.hasPresentation
          ? "attention"
          : "waiting",
      detail: input.hasAgreement
        ? "Agreement signed"
        : input.hasPresentation
          ? "Agreement needs signature"
          : "Waiting for a presentation",
    },
    {
      id: "payment",
      label: STAGE_LABELS.payment,
      status: input.paymentReady
        ? "complete"
        : input.hasAgreement
          ? "attention"
          : "waiting",
      detail: input.paymentReady
        ? "Card on file"
        : input.hasAgreement
          ? "Payment setup is incomplete"
          : "Waiting for a signed agreement",
    },
    {
      id: "email",
      label: STAGE_LABELS.email,
      status: !input.paymentReady
        ? "waiting"
        : input.manualEmailComplete || deliveryComplete
          ? "complete"
          : input.portalUrl
            ? "attention"
            : "waiting",
      detail: !input.paymentReady
        ? "Waiting for payment setup"
        : input.manualEmailComplete
          ? "Founder confirmed the email handoff"
          : deliveryComplete
          ? "Welcome email delivered"
          : deliveryAccepted
            ? "Email accepted; delivery pending"
            : deliveryFailed
              ? `Delivery needs attention (${welcomeStatus})`
              : input.portalUrl
                ? "Portal ready; delivery is unconfirmed"
                : "Portal link is not ready",
    },
    {
      id: "portal",
      label: STAGE_LABELS.portal,
      status: !input.paymentReady
        ? "waiting"
        : !input.portalUrl
          ? "waiting"
          : input.manualPortalComplete
            ? "complete"
            : "attention",
      detail: !input.paymentReady
        ? "Waiting for payment setup"
        : !input.portalUrl
          ? "Portal link is not ready"
          : input.manualPortalComplete
            ? "Founder confirmed customer portal access"
            : "Portal is ready; customer access is unconfirmed",
    },
    {
      id: "jobber",
      label: STAGE_LABELS.jobber,
      status: input.jobberLinked
        ? "complete"
        : input.paymentReady
          ? "attention"
          : "waiting",
      detail: input.jobberLinked
        ? "Customer identity paired"
        : input.paymentReady
          ? "Pair this customer to Jobber"
          : "Waiting for activation",
    },
    {
      id: "scheduled",
      label: STAGE_LABELS.scheduled,
      status: input.visitScheduled
        ? "complete"
        : input.jobberLinked
          ? "attention"
          : "waiting",
      detail: input.visitScheduled
        ? "Next visit is on the calendar"
        : input.jobberLinked
          ? "Next visit is not scheduled"
          : "Waiting for Jobber pairing",
    },
  ];
}

export function journeyCompletionPercent(stages: AtlasPulseStage[]): number {
  if (stages.length === 0) return 0;
  return Math.round(
    (stages.filter((stage) => stage.status === "complete").length /
      stages.length) *
      100,
  );
}

export function buildJourneyActions(input: {
  membershipId: string | null;
  presentationId: string | null;
  homeownerId: string | null;
  portalUrl: string | null;
  paymentReady: boolean;
  hasAgreement: boolean;
  manualEmailComplete?: boolean;
  manualPortalComplete?: boolean;
  jobberLinked: boolean;
  jobberWebUri: string | null;
  visitScheduled: boolean;
}): AtlasPulseAction[] {
  const actions: AtlasPulseAction[] = [];

  if (!input.hasAgreement && input.presentationId) {
    actions.push({
      id: "finish-agreement",
      kind: "open_link",
      label: "Finish agreement",
      href: `/presentations/${encodeURIComponent(input.presentationId)}/present`,
      primary: true,
    });
  }
  if (!input.paymentReady && input.membershipId) {
    actions.push({
      id: "repair-payment",
      kind: "open_link",
      label: "Repair payment setup",
      href: `/hq/customers/membership/${encodeURIComponent(input.membershipId)}`,
      primary: actions.length === 0,
    });
  }
  if (input.portalUrl) {
    actions.push({
      id: "copy-portal",
      kind: "copy_portal",
      label: "Copy verified portal link",
      portalUrl: input.portalUrl,
    });
  }
  if (input.membershipId && input.paymentReady && input.portalUrl) {
    actions.push({
      id: "resend-welcome",
      kind: "resend_welcome",
      label: "Resend welcome email",
      membershipId: input.membershipId,
    });
    const founderConfirmed = Boolean(
      input.manualEmailComplete && input.manualPortalComplete,
    );
    actions.push({
      id: founderConfirmed ? "undo-founder-confirmation" : "confirm-handoff",
      kind: "set_manual_completion",
      label: founderConfirmed
        ? "Undo founder confirmation"
        : "Mark email + portal complete",
      membershipId: input.membershipId,
      completed: !founderConfirmed,
    });
  }
  if (!input.jobberLinked) {
    actions.push({
      id: "pair-jobber",
      kind: "pair_jobber",
      label: "Pair in Jobber",
      href: "/hq/jobber",
      primary: actions.length === 0,
    });
  } else if (!input.visitScheduled && input.jobberWebUri) {
    actions.push({
      id: "schedule-jobber",
      kind: "open_jobber",
      label: "Schedule in Jobber",
      href: input.jobberWebUri,
      primary: actions.length === 0,
    });
  }
  if (input.membershipId || input.presentationId || input.homeownerId) {
    const type = input.membershipId
      ? "membership"
      : input.presentationId
        ? "presentation"
        : "homeowner";
    const id = input.membershipId ?? input.presentationId ?? input.homeownerId!;
    actions.push({
      id: "open-passport",
      kind: "open_link",
      label: "Open Home Passport",
      href: `/hq/customers/${type}/${encodeURIComponent(id)}`,
    });
  }
  return actions;
}

export function buildExceptionCodes(stages: AtlasPulseStage[]): string[] {
  return stages
    .filter((stage) => stage.status === "attention")
    .map((stage) => stage.id);
}

export function buildCareOpportunities(input: {
  month: number;
  recentServiceNames?: string[];
}): AtlasPulseOpportunity[] {
  const recent = normalizeText((input.recentServiceNames ?? []).join(" "));
  const opportunities: AtlasPulseOpportunity[] = [];

  if (!recent.includes("interior")) {
    opportunities.push({
      id: "interior_cleaning",
      label: "Interior window cleaning",
      reason: "Natural upgrade to the next glass-care visit",
      priceLabel: "+$100 standard",
      amount: 100,
    });
  }
  if (!recent.includes("screen")) {
    opportunities.push({
      id: "screen_cleaning",
      label: "Screen cleaning",
      reason: "Pair with window care while the crew is already onsite",
      priceLabel: "+$50 standard",
      amount: 50,
    });
  }
  if ([9, 10, 11, 12, 1].includes(input.month) && !recent.includes("gutter")) {
    opportunities.push({
      id: "gutter_care",
      label: "Gutter care assessment",
      reason: "Seasonal rain-readiness window",
      priceLabel: "Quote after assessment",
      amount: null,
    });
  }
  if ([3, 4, 5, 6, 7, 8].includes(input.month) && !recent.includes("solar")) {
    opportunities.push({
      id: "solar_panel_care",
      label: "Solar panel care",
      reason: "High-production season is approaching",
      priceLabel: "Quote after assessment",
      amount: null,
    });
  }
  if ([2, 3, 4, 5, 6].includes(input.month) && !recent.includes("pressure")) {
    opportunities.push({
      id: "pressure_washing",
      label: "Pressure washing",
      reason: "Spring exterior reset opportunity",
      priceLabel: "Quote after assessment",
      amount: null,
    });
  }
  return opportunities.slice(0, 3);
}
