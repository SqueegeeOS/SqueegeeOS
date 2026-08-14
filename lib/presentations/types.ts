import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import {
  normalizeToSqueegeeKingTier,
  squeegeeKingTierLabel,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import {
  isCarePlanQuoteSnapshot,
  type PresentationQuoteSnapshot,
} from "./quote-snapshot";
import type {
  PresentationCarePlan,
  PresentationLayout,
  PresentationPlanMode,
} from "./care-plan";

export type PresentationTier = SqueegeeKingTierId;
export type PresentationStatus = "draft" | "presented" | "signed";

/** Manual per-visit overrides keyed by membership tier. Omitted or 0 = pricing engine. */
export type VisitRateOverrides = Partial<Record<PresentationTier, number>>;

export type PresentationOnboardingStatus = "pending_payment" | "complete";

export interface SlideOverride {
  headline?: string;
  body?: string;
  highlight?: string;
}

/** Visual-first deck — 6 core slides (+ custom quote when applicable) */
export type SlideType =
  | "cover"
  | "included"
  | "care_plan"
  | "difference"
  | "investment"
  | "process"
  | "custom_quote"
  | "close";

/** Legacy slide ids — may exist in stored slide_overrides from older decks */
export type LegacySlideType =
  | "problem"
  | "solution"
  | "services"
  | "schedule"
  | "pricing"
  | "comparison"
  | "savings"
  | "testimonials"
  | "guarantee";

export interface SlideConfig {
  id: SlideType;
  label: string;
  description: string;
  editable: Array<keyof SlideOverride>;
}

export const SLIDE_MANIFEST: SlideConfig[] = [
  {
    id: "cover",
    label: "Welcome",
    description: "Client · property · first impression",
    editable: ["headline"],
  },
  {
    id: "included",
    label: "What's Included",
    description: "Visual care map — every visit",
    editable: ["highlight"],
  },
  {
    id: "care_plan",
    label: "Care Rhythm",
    description: "Visit-by-visit service plan",
    editable: ["headline"],
  },
  {
    id: "difference",
    label: "The Difference",
    description: "SqueegeeKing vs typical service",
    editable: ["headline", "body"],
  },
  {
    id: "investment",
    label: "Your Investment",
    description: "Pricing + Quarterly value (expandable)",
    editable: ["headline"],
  },
  {
    id: "process",
    label: "How It Works",
    description: "Four-step visual timeline",
    editable: [],
  },
  {
    id: "custom_quote",
    label: "Custom Quote",
    description: "Care Plan Builder numbers",
    editable: ["headline"],
  },
  {
    id: "close",
    label: "Get Started",
    description: "Sign · billing clarity · CTA",
    editable: ["headline", "body"],
  },
];

export function getPresentationSlides(
  presentation: Pick<
    PresentationData,
    "quoteSnapshot" | "presentationLayout" | "planMode"
  >,
): SlideConfig[] {
  const layout = presentation.presentationLayout ?? "signature";
  const allowedByLayout: Record<PresentationLayout, SlideType[]> = {
    signature: [
      "cover",
      "included",
      "care_plan",
      "difference",
      "investment",
      "process",
      "custom_quote",
      "close",
    ],
    concise: ["cover", "care_plan", "investment", "custom_quote", "close"],
    story: [
      "cover",
      "difference",
      "included",
      "care_plan",
      "process",
      "investment",
      "custom_quote",
      "close",
    ],
  };
  const order = allowedByLayout[layout];
  return order
    .map((id) => SLIDE_MANIFEST.find((slide) => slide.id === id))
    .filter((slide): slide is SlideConfig => !!slide)
    .filter(
      (slide) =>
        slide.id !== "custom_quote" ||
        (presentation.planMode !== "custom" &&
          isCarePlanQuoteSnapshot(presentation.quoteSnapshot)),
    );
}

export interface PresentationData {
  id: string;
  createdBy: string;
  /** Server-resolved field-sales owner. Never trust a browser creator label. */
  salesRepId: string | null;
  /** Optional originating lead; database constraints keep it owned by salesRepId. */
  salesRepLeadId: string | null;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  homeSqft: number;
  twoStory: boolean;
  includeScreens: boolean;
  includeInterior: boolean;
  /** Fast global options or an explicitly scheduled visit-by-visit plan. */
  planMode: PresentationPlanMode;
  presentationLayout: PresentationLayout;
  carePlan: PresentationCarePlan;
  tier: PresentationTier;
  /** Legacy per-visit override for the tier in `overrideTier` */
  monthlyRate: number;
  /** Tier `monthlyRate` applies to (legacy rows). */
  overrideTier?: PresentationTier | null;
  /** Per-tier manual visit overrides — source of truth for scoped pricing */
  visitRateOverrides?: VisitRateOverrides;
  annualRate: number;
  retailValue: number;
  /** Per-visit savings vs one-time at enrollment */
  enrollmentSavings: number;
  customNotes: string;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
  slideOverrides: Partial<
    Record<SlideType | LegacySlideType, SlideOverride>
  >;
  status: PresentationStatus;
  signedAt: string | null;
  agreementId: string | null;
  homeownerId: string | null;
  propertyId: string | null;
  membershipId: string | null;
  onboardingStatus: PresentationOnboardingStatus | null;
  createdAt: string;
  updatedAt: string;
}

export type PresentationInput = Omit<
  PresentationData,
  "id" | "createdAt" | "updatedAt" | "signedAt" | "agreementId" | "status"
> & {
  status?: PresentationStatus;
};

export interface SlideProps {
  presentation: PresentationData;
  overrides?: SlideOverride;
  onSign?: (tier: PresentationTier) => void;
}

export function tierLabel(tier: string): string {
  return squeegeeKingTierLabel(normalizeToSqueegeeKingTier(tier));
}

export function tierTagline(tier: string): string {
  return SQUEEGEEKING_TIERS[normalizeToSqueegeeKingTier(tier)].tagline;
}

export function normalizePresentationTier(tier: string): PresentationTier {
  return normalizeToSqueegeeKingTier(tier);
}
