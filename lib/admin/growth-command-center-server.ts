import "server-only";

import { isMembershipActive, isMembershipCancelled } from "@/lib/membership/membership-status";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import type { GrowthTruthSnapshot } from "./growth-command-center";

interface MembershipGrowthRow {
  status: string;
  agreement_id: string | null;
  annual_rate: number | null;
  visit_price: number | null;
  visits_per_year: number | null;
  started_at: string | null;
  created_at: string;
  payment_setup_completed_at: string | null;
  stripe_payment_method_id: string | null;
}

interface LeadGrowthRow {
  status: string;
  source: string;
  submitted_at: string;
}

interface PresentationGrowthRow {
  status: string;
  created_at: string;
  signed_at: string | null;
}

function emptySnapshot(warning: string): GrowthTruthSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    source: "unavailable",
    currentActiveArr: 0,
    onBookArr: 0,
    arrAddedLast30Days: 0,
    activeMembers: 0,
    membersOnBook: 0,
    cardOnFileCount: 0,
    leadsLast30Days: 0,
    signedMembersLast30Days: 0,
    directionalCloseRate: null,
    averageMemberArr: null,
    openLeads: 0,
    draftPresentations: 0,
    presentedNotSigned: 0,
    sourceMix: { website: 0, facebook: 0 },
    warnings: [warning],
  };
}

function yearlyValue(row: MembershipGrowthRow): number {
  const annual = Number(row.annual_rate ?? 0);
  if (Number.isFinite(annual) && annual > 0) return annual;
  const visit = Number(row.visit_price ?? 0);
  const visits = Number(row.visits_per_year ?? 0);
  return Number.isFinite(visit) && Number.isFinite(visits) && visit > 0 && visits > 0
    ? visit * visits
    : 0;
}

export async function loadGrowthTruthSnapshot(): Promise<GrowthTruthSnapshot> {
  if (!isSupabaseConfigured()) {
    return emptySnapshot("Supabase is not configured in this environment.");
  }

  const supabase = createServerSupabaseClient();
  const [membershipsResult, leadsResult, presentationsResult] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "status, agreement_id, annual_rate, visit_price, visits_per_year, started_at, created_at, payment_setup_completed_at, stripe_payment_method_id",
      ),
    supabase.from("lead_intakes").select("status, source, submitted_at"),
    supabase.from("presentations").select("status, created_at, signed_at"),
  ]);

  const errors = [
    membershipsResult.error?.message,
    leadsResult.error?.message,
    presentationsResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  if (errors.length > 0) {
    return emptySnapshot(`Growth truth could not load: ${errors.join(" | ")}`);
  }

  const memberships = (membershipsResult.data ?? []) as MembershipGrowthRow[];
  const leads = (leadsResult.data ?? []) as LeadGrowthRow[];
  const presentations = (presentationsResult.data ?? []) as PresentationGrowthRow[];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString();
  const onBook = memberships.filter(
    (row) => !isMembershipCancelled(row) && Boolean(row.agreement_id),
  );
  const active = memberships.filter((row) => isMembershipActive(row));
  const signedLast30 = onBook.filter(
    (row) => (row.started_at ?? row.created_at) >= cutoff,
  );
  const leadsLast30 = leads.filter((lead) => lead.submitted_at >= cutoff);
  const onBookArr = onBook.reduce((sum, row) => sum + yearlyValue(row), 0);
  const activeArr = active.reduce((sum, row) => sum + yearlyValue(row), 0);

  return {
    generatedAt: new Date().toISOString(),
    source: "supabase",
    currentActiveArr: activeArr,
    onBookArr,
    arrAddedLast30Days: signedLast30.reduce(
      (sum, row) => sum + yearlyValue(row),
      0,
    ),
    activeMembers: active.length,
    membersOnBook: onBook.length,
    cardOnFileCount: onBook.filter(
      (row) =>
        Boolean(row.payment_setup_completed_at) ||
        Boolean(row.stripe_payment_method_id),
    ).length,
    leadsLast30Days: leadsLast30.length,
    signedMembersLast30Days: signedLast30.length,
    directionalCloseRate:
      leadsLast30.length > 0
        ? Math.min(100, (signedLast30.length / leadsLast30.length) * 100)
        : null,
    averageMemberArr: onBook.length > 0 ? onBookArr / onBook.length : null,
    openLeads: leads.filter((lead) => lead.status === "new").length,
    draftPresentations: presentations.filter(
      (presentation) => presentation.status === "draft",
    ).length,
    presentedNotSigned: presentations.filter(
      (presentation) => presentation.status === "presented",
    ).length,
    sourceMix: {
      website: leadsLast30.filter((lead) => lead.source !== "facebook_lead_ad")
        .length,
      facebook: leadsLast30.filter((lead) => lead.source === "facebook_lead_ad")
        .length,
    },
    warnings:
      leadsLast30.length === 0
        ? ["No lead cohort exists in the last 30 days, so close rate is unknown."]
        : [
            "Thirty-day close rate is directional: signed members and leads are not yet cohort-matched one-to-one.",
          ],
  };
}
