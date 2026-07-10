import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { getLeadIntakeById } from "@/lib/acquisition/leads/repository";
import { listClosedJobsFromSupabase } from "@/lib/admin/closed-jobs-server";
import type { ClosedJob } from "@/lib/admin/closed-jobs-types";
import { resolveAgreementPdfAccessUrl } from "@/lib/agreement/signed-agreement-storage";
import {
  isMembershipPendingEnrollment,
  resolveMembershipLifecycle,
} from "@/lib/membership/membership-status";
import { resolvePortalPaymentState } from "@/lib/membership/portal-payment-state";
import { resolvePortalPaymentMethodLabel } from "@/lib/membership/resolve-portal-payment-method";
import { getPortalAccessUrlForMembership } from "@/lib/persistence/queries/portal-access";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { getPresentation } from "@/lib/presentations/repository";
import { customerWorkspaceHref } from "./routes";
import type {
  CustomerWorkspace,
  CustomerWorkspaceAction,
  CustomerWorkspaceRefType,
  CustomerWorkspaceStage,
} from "./types";

function stageLabel(stage: CustomerWorkspaceStage): string {
  switch (stage) {
    case "request":
      return "New request";
    case "presenting":
      return "Presentation";
    case "onboarding":
      return "Onboarding";
    case "active":
      return "Active member";
    case "ledger":
      return "Sales record";
    default:
      return "Customer";
  }
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchClosedJobs(
  jobs: ClosedJob[],
  name: string,
  address: string,
): ClosedJob[] {
  const nameKey = normalize(name);
  const addressKey = normalize(address);
  if (!nameKey && !addressKey) return [];

  return jobs.filter((job) => {
    const jobName = normalize(job.customerName);
    const jobAddress = normalize(job.propertyAddress);
    const nameMatch =
      !nameKey || jobName.includes(nameKey) || nameKey.includes(jobName);
    const addressMatch =
      !addressKey ||
      jobAddress.includes(addressKey) ||
      addressKey.includes(jobAddress);
    return nameMatch && addressMatch;
  });
}

function mapLeadRow(row: Record<string, unknown>): LeadIntakeRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    email: row.email as string,
    serviceAddress: row.service_address as string,
    servicesInterested:
      row.services_interested as LeadIntakeRecord["servicesInterested"],
    preferredContactMethod:
      row.preferred_contact_method as LeadIntakeRecord["preferredContactMethod"],
    notes: row.notes as string,
    membershipTier: row.membership_tier as LeadIntakeRecord["membershipTier"],
    squareFootage: row.square_footage as number | null,
    estimatedVisitPrice: row.estimated_visit_price as number | null,
    preferredStartWindow: row.preferred_start_window as string | null,
    status: row.status as LeadIntakeRecord["status"],
    submittedAt: row.submitted_at as string,
    source: "request_form",
  };
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function findPropertyByContact(
  name: string,
  email: string | null,
  address: string,
): Promise<string | null> {
  if (!isCloudPersistenceConnected()) return null;
  const supabase = createServerSupabaseClient();
  const addressToken = address.split(",")[0]?.trim() ?? address;

  if (email) {
    const { data: homeowner } = await supabase
      .from("homeowners")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle();
    if (homeowner?.id && addressToken) {
      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("homeowner_id", homeowner.id)
        .ilike("address", `%${addressToken}%`)
        .limit(1)
        .maybeSingle();
      if (property?.id) return property.id as string;
    }
  }

  if (!addressToken) return null;

  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, homeowners!inner(full_name)")
    .ilike("address", `%${addressToken}%`)
    .limit(5);

  const nameKey = normalize(name);
  for (const row of properties ?? []) {
    const homeowner = firstRelation(
      row.homeowners as { full_name?: string } | { full_name?: string }[],
    );
    const homeownerName = normalize(homeowner?.full_name);
    if (
      homeownerName &&
      (homeownerName.includes(nameKey) || nameKey.includes(homeownerName))
    ) {
      return row.id as string;
    }
  }

  return null;
}

async function loadPropertyWorkspace(
  propertyId: string,
  ref: CustomerWorkspace["ref"],
): Promise<CustomerWorkspace | null> {
  if (!isCloudPersistenceConnected()) return null;
  const supabase = createServerSupabaseClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select(
      "id, slug, name, address, city, state, zip, square_feet, homeowner_id, homeowners!inner(id, slug, full_name, first_name, email, phone)",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (error || !property) return null;

  const homeowner = firstRelation(property.homeowners);
  if (!homeowner) return null;

  const [{ data: membership }, { data: presentationByProperty }, closedJobsRes] =
    await Promise.all([
      supabase
        .from("memberships")
        .select(
          "id, status, plan_name, sales_tier, visit_price, visits_per_year, payment_setup_completed_at, started_at, founding_member, presentation_id, agreement_id, stripe_payment_method_id",
        )
        .eq("property_id", propertyId)
        .maybeSingle(),
      supabase
        .from("presentations")
        .select("id, status, onboarding_status, tier")
        .eq("property_id", propertyId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      listClosedJobsFromSupabase(),
    ]);

  let presentation = presentationByProperty;
  if (!presentation && membership?.presentation_id) {
    const loaded = await getPresentation(membership.presentation_id as string);
    if (loaded) {
      presentation = {
        id: loaded.id,
        status: loaded.status,
        onboarding_status: loaded.onboardingStatus,
        tier: loaded.tier,
      };
    }
  }

  const { data: agreement } = membership?.agreement_id
    ? await supabase
        .from("signed_agreements")
        .select("id, plan_name, signed_at, agreement_pdf_url")
        .eq("id", membership.agreement_id)
        .maybeSingle()
    : { data: null };

  const { data: obligations } = membership?.id
    ? await supabase
        .from("obligations")
        .select("id, sequence, status, target_window_start, target_window_end")
        .eq("membership_id", membership.id)
        .order("sequence", { ascending: true })
    : { data: [] };

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("id")
    .eq("homeowner_id", homeowner.id)
    .maybeSingle();

  const { data: appointments } = profile?.id
    ? await supabase
        .from("member_appointments")
        .select("id, service_type, scheduled_at, status")
        .eq("member_profile_id", profile.id)
        .eq("property_id", propertyId)
        .order("scheduled_at", { ascending: false })
    : { data: [] };

  const { data: leadMatch } = homeowner.email
    ? await supabase
        .from("lead_intakes")
        .select("*")
        .ilike("email", homeowner.email)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const portalUrl = membership?.id
    ? await getPortalAccessUrlForMembership(membership.id as string)
    : null;

  const agreementPdfUrl = agreement?.agreement_pdf_url
    ? await resolveAgreementPdfAccessUrl(agreement.agreement_pdf_url as string)
    : null;

  const paymentMethodLabel =
    membership?.payment_setup_completed_at &&
    membership?.stripe_payment_method_id
      ? await resolvePortalPaymentMethodLabel(
          membership.stripe_payment_method_id as string,
        )
      : null;

  const paymentState = membership
    ? resolvePortalPaymentState({
        membershipStatus: membership.status as string,
        paymentSetupCompletedAt:
          (membership.payment_setup_completed_at as string | null) ?? null,
        paymentMethodLabel,
        hasMembership: true,
      })
    : null;

  let stage: CustomerWorkspaceStage = "unknown";
  if (membership) {
    const lifecycle = resolveMembershipLifecycle({
      status: membership.status as string,
      payment_setup_completed_at:
        (membership.payment_setup_completed_at as string | null) ?? null,
      stripe_payment_method_id:
        (membership.stripe_payment_method_id as string | null) ?? null,
      agreement_id: (membership.agreement_id as string | null) ?? undefined,
      sales_tier: (membership.sales_tier as string | null) ?? undefined,
      visit_price: (membership.visit_price as number | null) ?? undefined,
      onboardingStatus:
        (presentation?.onboarding_status as string | null) ?? undefined,
      presentationStatus: presentation?.status as string | undefined,
      signedAgreementStatus: agreement ? "complete" : undefined,
    });

    if (lifecycle.isActive) {
      stage = "active";
    } else if (
      isMembershipPendingEnrollment(
        {
          status: membership.status as string,
          payment_setup_completed_at:
            (membership.payment_setup_completed_at as string | null) ?? null,
          agreement_id: (membership.agreement_id as string | null) ?? undefined,
        },
        {
          hasSignedAgreement: Boolean(agreement),
          onboardingStatus:
            (presentation?.onboarding_status as string | null) ?? null,
        },
      )
    ) {
      stage = "onboarding";
    } else if (presentation) {
      stage = presentation.status === "signed" ? "onboarding" : "presenting";
    }
  } else if (presentation) {
    stage = presentation.status === "signed" ? "onboarding" : "presenting";
  }

  const actions: CustomerWorkspaceAction[] = [];
  if (presentation) {
    actions.push({
      id: "edit_presentation",
      label: "Edit presentation",
      href: `/presentations/${presentation.id}/edit`,
    });
    actions.push({
      id: "present",
      label:
        presentation.status === "signed" ? "Continue onboarding" : "Present",
      href: `/presentations/${presentation.id}/present`,
      primary: stage === "onboarding" || stage === "presenting",
    });
  }
  if (portalUrl) {
    actions.push({
      id: "portal",
      label: "Open member portal",
      href: portalUrl,
      primary: stage === "active",
    });
  }
  if (agreementPdfUrl) {
    actions.push({
      id: "agreement",
      label: "View agreement",
      href: agreementPdfUrl,
    });
  }
  actions.push({
    id: "property_memory",
    label: "Property memory",
    href: `/hq/properties/${propertyId}/health`,
  });
  actions.push({
    id: "document_visit",
    label: "Document visit",
    href: `/hq/properties/${propertyId}/visit`,
    primary: stage === "active",
  });

  const upcomingWork = (obligations ?? [])
    .filter((row) => row.status === "promised" || row.status === "scheduled")
    .map((row) => ({
      id: row.id as string,
      label: `Visit ${row.sequence}`,
      date: row.target_window_start as string,
      status: row.status as string,
      kind: "obligation" as const,
    }));

  const completedFromObligations = (obligations ?? [])
    .filter((row) => row.status === "completed")
    .map((row) => ({
      id: row.id as string,
      label: `Visit ${row.sequence}`,
      date: row.target_window_end as string,
      status: row.status as string,
      kind: "obligation" as const,
    }));

  const appointmentWork = (appointments ?? []).map((row) => ({
    id: row.id as string,
    label: (row.service_type as string).replaceAll("_", " "),
    date: row.scheduled_at as string,
    status: row.status as string,
    kind: "appointment" as const,
  }));

  const completedWork = [
    ...completedFromObligations,
    ...appointmentWork.filter((row) => row.status === "completed"),
  ];

  const timeline = [
    ...(agreement?.signed_at
      ? [
          {
            id: `agreement-${agreement.id}`,
            date: agreement.signed_at as string,
            title: "Agreement signed",
            detail: agreement.plan_name as string,
          },
        ]
      : []),
    ...(membership?.started_at
      ? [
          {
            id: `membership-${membership.id}`,
            date: membership.started_at as string,
            title: "Membership started",
            detail: membership.plan_name as string,
          },
        ]
      : []),
    ...appointmentWork.slice(0, 5).map((row) => ({
      id: `appt-${row.id}`,
      date: row.date,
      title: row.label,
      detail: row.status,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const lead = leadMatch ? mapLeadRow(leadMatch as Record<string, unknown>) : null;

  return {
    ref,
    canonical: { type: "property", id: propertyId },
    stage,
    stageLabel: stageLabel(stage),
    headline: homeowner.full_name,
    subheadline: `${property.name} · ${property.address}, ${property.city}`,
    contact: {
      name: homeowner.full_name,
      email: homeowner.email,
      phone: homeowner.phone,
      preferredContact: lead?.preferredContactMethod ?? null,
    },
    property: {
      id: property.id as string,
      name: property.name as string,
      address: property.address as string,
      city: property.city as string,
      state: property.state as string,
      zip: property.zip as string,
      squareFeet: (property.square_feet as number | null) ?? null,
      homeownerId: homeowner.id,
      homeownerSlug: homeowner.slug,
      propertySlug: property.slug as string,
    },
    lead,
    presentation: presentation
      ? {
          id: presentation.id as string,
          status: presentation.status as string,
          onboardingStatus:
            (presentation.onboarding_status as string | null) ?? null,
          tier: presentation.tier as string,
          editHref: `/presentations/${presentation.id}/edit`,
          presentHref: `/presentations/${presentation.id}/present`,
        }
      : null,
    membership: membership
      ? {
          id: membership.id as string,
          status: membership.status as string,
          planName: membership.plan_name as string,
          salesTier: (membership.sales_tier as string | null) ?? null,
          visitPrice: (membership.visit_price as number | null) ?? null,
          visitsPerYear: (membership.visits_per_year as number | null) ?? null,
          paymentSetupCompletedAt:
            (membership.payment_setup_completed_at as string | null) ?? null,
          startedAt: (membership.started_at as string | null) ?? null,
          foundingMember: Boolean(membership.founding_member),
        }
      : null,
    agreement: agreement
      ? {
          id: agreement.id as string,
          planName: agreement.plan_name as string,
          signedAt: agreement.signed_at as string,
          pdfUrl: agreementPdfUrl,
        }
      : null,
    portalUrl,
    paymentHeadline: paymentState?.headline ?? null,
    paymentDetail: paymentState?.detailLine ?? null,
    notes: lead?.notes ?? "",
    upcomingWork,
    completedWork,
    timeline,
    closedJobs: matchClosedJobs(
      closedJobsRes.jobs,
      homeowner.full_name,
      `${property.address}, ${property.city}`,
    ),
    actions,
  };
}

export async function loadCustomerWorkspace(
  type: CustomerWorkspaceRefType,
  id: string,
): Promise<CustomerWorkspace | null> {
  if (type === "property") {
    return loadPropertyWorkspace(id, { type, id });
  }

  if (type === "lead") {
    const lead = await getLeadIntakeById(id);
    if (!lead) return null;

    const matchedPropertyId = await findPropertyByContact(
      lead.name,
      lead.email,
      lead.serviceAddress,
    );
    if (matchedPropertyId) {
      return loadPropertyWorkspace(matchedPropertyId, {
        type: "property",
        id: matchedPropertyId,
      });
    }

    const closedJobsRes = await listClosedJobsFromSupabase();

    return {
      ref: { type, id },
      canonical: null,
      stage: "request",
      stageLabel: stageLabel("request"),
      headline: lead.name,
      subheadline: lead.serviceAddress,
      contact: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        preferredContact: lead.preferredContactMethod,
      },
      property: null,
      lead,
      presentation: null,
      membership: null,
      agreement: null,
      portalUrl: null,
      paymentHeadline: null,
      paymentDetail: null,
      notes: lead.notes,
      upcomingWork: [],
      completedWork: [],
      timeline: [
        {
          id: `lead-${lead.id}`,
          date: lead.submittedAt,
          title: "Request submitted",
          detail: lead.servicesInterested.join(", ") || null,
        },
      ],
      closedJobs: matchClosedJobs(
        closedJobsRes.jobs,
        lead.name,
        lead.serviceAddress,
      ),
      actions: [
        {
          id: "open_request",
          label: "Open request inbox",
          href: customerWorkspaceHref("lead", id),
        },
      ],
    };
  }

  if (type === "presentation") {
    const presentation = await getPresentation(id);
    if (!presentation) return null;

    if (presentation.propertyId) {
      return loadPropertyWorkspace(presentation.propertyId, {
        type: "property",
        id: presentation.propertyId,
      });
    }

    const closedJobsRes = await listClosedJobsFromSupabase();
    const stage: CustomerWorkspaceStage =
      presentation.status === "signed" ? "onboarding" : "presenting";

    return {
      ref: { type, id },
      canonical: null,
      stage,
      stageLabel: stageLabel(stage),
      headline: presentation.clientName,
      subheadline: presentation.clientAddress || null,
      contact: {
        name: presentation.clientName,
        email: presentation.clientEmail || null,
        phone: null,
        preferredContact: null,
      },
      property: null,
      lead: null,
      presentation: {
        id: presentation.id,
        status: presentation.status,
        onboardingStatus: presentation.onboardingStatus,
        tier: presentation.tier,
        editHref: `/presentations/${presentation.id}/edit`,
        presentHref: `/presentations/${presentation.id}/present`,
      },
      membership: null,
      agreement: null,
      portalUrl: null,
      paymentHeadline: null,
      paymentDetail: null,
      notes: presentation.customNotes,
      upcomingWork: [],
      completedWork: [],
      timeline: [
        {
          id: `presentation-${presentation.id}`,
          date: presentation.updatedAt,
          title: "Presentation updated",
          detail: presentation.status,
        },
      ],
      closedJobs: matchClosedJobs(
        closedJobsRes.jobs,
        presentation.clientName,
        presentation.clientAddress,
      ),
      actions: [
        {
          id: "present",
          label:
            presentation.status === "signed"
              ? "Continue onboarding"
              : "Present",
          href: `/presentations/${presentation.id}/present`,
          primary: true,
        },
        {
          id: "edit_presentation",
          label: "Edit presentation",
          href: `/presentations/${presentation.id}/edit`,
        },
      ],
    };
  }

  if (type === "closed-job") {
    const closedJobsRes = await listClosedJobsFromSupabase();
    const job = closedJobsRes.jobs.find((entry) => entry.id === id);
    if (!job) return null;

    const matchedPropertyId = await findPropertyByContact(
      job.customerName,
      null,
      job.propertyAddress,
    );
    if (matchedPropertyId) {
      return loadPropertyWorkspace(matchedPropertyId, {
        type: "property",
        id: matchedPropertyId,
      });
    }

    return {
      ref: { type, id },
      canonical: null,
      stage: "ledger",
      stageLabel: stageLabel("ledger"),
      headline: job.customerName,
      subheadline: job.propertyAddress,
      contact: {
        name: job.customerName,
        email: null,
        phone: null,
        preferredContact: null,
      },
      property: null,
      lead: null,
      presentation: null,
      membership: null,
      agreement: null,
      portalUrl: null,
      paymentHeadline: null,
      paymentDetail: null,
      notes: job.notes,
      upcomingWork: [],
      completedWork: [],
      timeline: [
        {
          id: `closed-${job.id}`,
          date: job.closedDate,
          title: "Sale logged",
          detail: job.serviceCategory,
        },
      ],
      closedJobs: [job],
      actions: [
        {
          id: "new_presentation",
          label: "Start presentation",
          href: "/presentations/new",
          primary: true,
        },
      ],
    };
  }

  return null;
}
