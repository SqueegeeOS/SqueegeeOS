import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import {
  normalizeToSqueegeeKingTier,
  squeegeeKingTierLabel,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import type { PresentationQuoteSnapshot } from "./quote-snapshot";

export type PresentationTier = SqueegeeKingTierId;
export type PresentationStatus = "draft" | "presented" | "signed";

export interface SlideOverride {
  headline?: string;
  body?: string;
  highlight?: string;
}

export type SlideType =
  | "cover"
  | "problem"
  | "solution"
  | "services"
  | "schedule"
  | "pricing"
  | "custom_quote"
  | "comparison"
  | "savings"
  | "testimonials"
  | "guarantee"
  | "close";

export interface SlideConfig {
  id: SlideType;
  label: string;
  description: string;
  editable: Array<keyof SlideOverride>;
}

export const SLIDE_MANIFEST: SlideConfig[] = [
  { id: "cover", label: "Cover", description: "Client name · address · tier", editable: ["headline"] },
  { id: "problem", label: "The Problem", description: "Why home maintenance fails", editable: ["headline", "body"] },
  { id: "solution", label: "The Solution", description: "What SqueegeeKing does differently", editable: ["headline", "body"] },
  { id: "services", label: "Services Included", description: "Benefits by tier", editable: ["highlight"] },
  { id: "schedule", label: "Your Schedule", description: "Annual visit calendar", editable: [] },
  { id: "pricing", label: "Standard Pricing", description: "Every 3 vs 6 months per visit", editable: ["headline"] },
  { id: "custom_quote", label: "Your Custom Quote", description: "Window care + exterior add-ons from builder", editable: ["headline"] },
  { id: "comparison", label: "Tier Comparison", description: "Side-by-side benefit table", editable: ["body"] },
  { id: "savings", label: "The Math", description: "RainBlock + Hard Water upgrade value", editable: [] },
  { id: "testimonials", label: "Member Stories", description: "Social proof", editable: ["highlight"] },
  { id: "guarantee", label: "Our Guarantee", description: "7-day workmanship guarantee", editable: ["body"] },
  { id: "close", label: "Ready to Start", description: "Dual sign buttons", editable: ["headline", "body"] },
];

export function getPresentationSlides(
  presentation: Pick<PresentationData, "quoteSnapshot">,
): SlideConfig[] {
  return SLIDE_MANIFEST.filter(
    (slide) => slide.id !== "custom_quote" || presentation.quoteSnapshot,
  );
}

export interface PresentationData {
  id: string;
  createdBy: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  homeSqft: number;
  tier: PresentationTier;
  /** Per-visit rate (legacy field name) */
  monthlyRate: number;
  annualRate: number;
  retailValue: number;
  customNotes: string;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
  slideOverrides: Partial<Record<SlideType, SlideOverride>>;
  status: PresentationStatus;
  signedAt: string | null;
  agreementId: string | null;
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
