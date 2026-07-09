"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgreementSignaturePad } from "@/components/agreement/agreement-signature-pad";
import { CardOnFileSetup } from "@/components/membership/card-on-file-setup";
import {
  MEMBERSHIP_BILLING_PHILOSOPHY,
  MEMBERSHIP_BILLING_SCHEDULE_BODY,
  MEMBERSHIP_BILLING_SCHEDULE_HEADLINE,
  MEMBERSHIP_CARD_ON_FILE_WHY,
  membershipAgreementCheckboxText,
} from "@/lib/agreement/agreement-content";
import {
  markMemberWelcomePending,
} from "@/lib/membership/unlock-sequence";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { portalWelcomePathFromUrl } from "@/lib/pwa/install-welcome";
import { cachePresentation } from "@/lib/presentations/client-cache";
import {
  computePresentationRates,
  slugifyPresentation,
} from "@/lib/presentations/calculations";
import {
  clearOnboardingStep,
  readOnboardingStep,
  saveOnboardingStep,
  type PersistedOnboardingStep,
} from "@/lib/presentations/onboarding-session";
import {
  tierLabel,
  tierTagline,
  type PresentationData,
  type PresentationOnboardingStatus,
  type PresentationTier,
} from "@/lib/presentations/types";
import {
  calculateAnnualFromVisits,
  formatTierPrice,
  planNameForAgreement,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import type { MembershipPlanId } from "@/lib/membership/types";

type OnboardingStep = PersistedOnboardingStep;

const STEP_ORDER: Record<OnboardingStep, number> = {
  sign: 0,
  welcome: 1,
  payment: 2,
  complete: 3,
};

function tierToPlanId(_tier: PresentationTier): MembershipPlanId {
  return "preferred";
}

function resolveInitialStep(presentation: PresentationData): OnboardingStep {
  if (presentation.onboardingStatus === "complete") return "complete";
  const saved = readOnboardingStep(presentation.id);
  if (saved) return saved;
  if (
    presentation.onboardingStatus === "pending_payment" &&
    presentation.membershipId
  ) {
    return "welcome";
  }
  return "sign";
}

function ChecklistItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-white/70">
      <span className="mt-0.5 text-accent" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

export function PresentationOnboarding({
  presentation,
  selectedTier,
  onClose,
  onDone,
  onPresentationChange,
}: {
  presentation: PresentationData;
  selectedTier: PresentationTier;
  onClose: () => void;
  onDone: () => void;
  onPresentationChange?: (next: PresentationData) => void;
}) {
  const [step, setStep] = useState<OnboardingStep>(() =>
    resolveInitialStep(presentation),
  );
  const stepRef = useRef(step);
  const [tier, setTier] = useState<PresentationTier>(selectedTier);
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSaved, setPaymentSaved] = useState(
    () => presentation.onboardingStatus === "complete",
  );
  const [membershipId, setMembershipId] = useState<string | null>(
    presentation.membershipId,
  );
  const [onboardingStatus, setOnboardingStatus] =
    useState<PresentationOnboardingStatus | null>(presentation.onboardingStatus);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  const refreshPortalUrl = async () => {
    try {
      const res = await fetch(
        `/api/membership/onboarding-status?presentationId=${presentation.id}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { portalUrl?: string | null };
      if (data.portalUrl) setPortalUrl(data.portalUrl);
    } catch {
      // Portal link is optional when cloud persistence is unavailable.
    }
  };

  const goToStep = (next: OnboardingStep) => {
    stepRef.current = next;
    setStep(next);
    saveOnboardingStep(presentation.id, next);
  };

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const rates = computePresentationRates({ ...presentation, tier });
  const visitPrice =
    tier === "biannual" ? rates.biannualVisit : rates.quarterlyVisit;
  const annualTotal = calculateAnnualFromVisits(tier, visitPrice);

  const syncPresentation = (next: PresentationData) => {
    cachePresentation(next);
    onPresentationChange?.(next);
  };

  useEffect(() => {
    if (step !== "sign") {
      saveOnboardingStep(presentation.id, step);
    }
  }, [presentation.id, step]);

  useEffect(() => {
    if (step === "welcome" || step === "complete") {
      void refreshPortalUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, presentation.id]);

  useEffect(() => {
    let cancelled = false;

    async function resumeOnboarding() {
      if (presentation.onboardingStatus === "complete") {
        goToStep("complete");
        setPaymentSaved(true);
        return;
      }

      if (
        presentation.onboardingStatus === "pending_payment" &&
        presentation.membershipId
      ) {
        setMembershipId(presentation.membershipId);
        setOnboardingStatus("pending_payment");
        if (STEP_ORDER[stepRef.current] < STEP_ORDER.welcome) {
          goToStep("welcome");
        }
        return;
      }

      if (STEP_ORDER[stepRef.current] >= STEP_ORDER.payment) {
        return;
      }

      try {
        const res = await fetch(
          `/api/membership/onboarding-status?presentationId=${presentation.id}`,
        );
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as {
          onboardingStatus?: PresentationOnboardingStatus | null;
          membershipId?: string | null;
          onboardingIncomplete?: boolean;
        };

        if (cancelled) return;

        if (STEP_ORDER[stepRef.current] >= STEP_ORDER.payment) {
          return;
        }

        if (data.onboardingStatus === "complete") {
          goToStep("complete");
          setPaymentSaved(true);
          setOnboardingStatus("complete");
          if (data.membershipId) setMembershipId(data.membershipId);
          return;
        }

        if (data.onboardingIncomplete && data.membershipId) {
          setMembershipId(data.membershipId);
          setOnboardingStatus("pending_payment");
          if (STEP_ORDER[stepRef.current] < STEP_ORDER.welcome) {
            goToStep("welcome");
          }
        }
      } catch {
        // Local-only presentations have no cloud status — stay on sign step.
      }
    }

    void resumeOnboarding();
    return () => {
      cancelled = true;
    };
    // Run once on mount — step guards prevent stale regressions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation.id]);

  const handleSign = async () => {
    if (!signature || !agreed) return;
    setLoading(true);
    setError(null);

    try {
      const signedAt = new Date().toISOString();
      const homeownerSlug = slugifyPresentation(presentation.clientName) || "client";
      const propertySlug =
        slugifyPresentation(presentation.clientAddress) || "property";

      const signRes = await fetch("/api/sign-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberName: presentation.clientName,
          memberEmail: presentation.clientEmail || undefined,
          homeownerSlug,
          propertySlug,
          propertyName: presentation.clientAddress || presentation.clientName,
          planId: tierToPlanId(tier),
          planName: planNameForAgreement(tier),
          signatureDataUrl: signature,
          signedAt,
          monthlyPrice: visitPrice,
          presentationId: presentation.id,
          agreementTier: tier,
          homeSqft: presentation.homeSqft,
          twoStory: presentation.twoStory,
          includeScreens: presentation.includeScreens,
          includeInterior: presentation.quoteSnapshot?.includeInterior ?? false,
          quoteSnapshot: presentation.quoteSnapshot ?? null,
        }),
      });

      const signBody = (await signRes.json().catch(() => null)) as {
        agreementId?: string;
        membershipId?: string;
        homeownerId?: string;
        propertyId?: string;
        onboardingStatus?: PresentationOnboardingStatus;
        portalUrl?: string | null;
        error?: string;
      } | null;

      if (!signRes.ok) {
        throw new Error(signBody?.error ?? "Signing failed");
      }

      if (!signBody?.agreementId) {
        throw new Error("Agreement was not saved — please try again.");
      }

      const signedPresentation: PresentationData = {
        ...presentation,
        status: "signed",
        signedAt,
        agreementId: signBody.agreementId,
        membershipId: signBody.membershipId ?? null,
        homeownerId: signBody.homeownerId ?? null,
        propertyId: signBody.propertyId ?? null,
        onboardingStatus: signBody.onboardingStatus ?? "pending_payment",
        tier,
        monthlyRate: visitPrice,
        annualRate: annualTotal,
      };
      syncPresentation(signedPresentation);

      if (signBody.membershipId) {
        setMembershipId(signBody.membershipId);
      }
      if (signBody.portalUrl) {
        setPortalUrl(signBody.portalUrl);
      }
      setOnboardingStatus(signBody.onboardingStatus ?? "pending_payment");
      goToStep("welcome");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    const completedPresentation: PresentationData = {
      ...presentation,
      status: "signed",
      onboardingStatus: "complete",
      membershipId: membershipId ?? presentation.membershipId,
    };
    syncPresentation(completedPresentation);
    setPaymentSaved(true);
    setOnboardingStatus("complete");
    markMemberWelcomePending();
    goToStep("complete");
  };

  const handleDone = () => {
    clearOnboardingStep(presentation.id);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center overflow-y-auto bg-[#060606]/92 p-5 backdrop-blur-md sm:items-center">
      <div className="relative my-auto w-full max-w-lg">
        {step === "sign" ? (
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] p-8 sm:p-10">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-xl text-white/40"
              aria-label="Close"
            >
              ×
            </button>

            <p className="text-[10px] uppercase tracking-[0.18em] text-accent/60">
              Membership Agreement
            </p>
            <h2 className="mt-2 font-serif text-3xl font-light text-[#f5f2eb]">
              {presentation.clientName}
            </h2>
            <p className="mt-2 text-sm text-white/40">
              {tierLabel(tier)} · {tierTagline(tier)} ·{" "}
              {formatTierPrice(visitPrice)}/visit ·{" "}
              {SQUEEGEEKING_TIERS[tier].addonDiscount}% OFF add-ons
            </p>

            <div className="mt-4 flex gap-2">
              {(["biannual", "quarterly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTier(option)}
                  className={`flex-1 rounded border px-3 py-2 text-[11px] uppercase tracking-[0.12em] ${
                    tier === option
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-white/10 text-white/40"
                  }`}
                >
                  {SQUEEGEEKING_TIERS[option].label}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left">
              <p className="font-serif text-sm italic leading-relaxed text-accent/80">
                {MEMBERSHIP_BILLING_PHILOSOPHY}
              </p>
              <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-accent/70">
                {MEMBERSHIP_BILLING_SCHEDULE_HEADLINE}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {MEMBERSHIP_BILLING_SCHEDULE_BODY}
              </p>
            </div>

            <div className="mt-6">
              <AgreementSignaturePad
                onSigned={setSignature}
                onCleared={() => setSignature(null)}
                disabled={loading}
              />
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 accent-accent"
              />
              <span className="text-xs leading-relaxed text-white/50">
                {membershipAgreementCheckboxText()} I authorize{" "}
                {formatTierPrice(visitPrice)} per visit (
                {formatTierPrice(annualTotal)}/year) for the SqueegeeKing{" "}
                {tierLabel(tier)} plan.
              </span>
            </label>

            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

            <button
              type="button"
              onClick={handleSign}
              disabled={!signature || !agreed || loading}
              className="mt-5 w-full rounded py-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 enabled:bg-gradient-to-br enabled:from-accent enabled:to-[#e8d5a3] enabled:text-[#060606]"
            >
              {loading ? "Processing…" : "Sign & Confirm Membership"}
            </button>
          </div>
        ) : null}

        {step === "welcome" ? (
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] p-8 text-center sm:p-10">
            <div className="mx-auto mb-6 h-px w-12 bg-accent/30" aria-hidden />
            <h2 className="font-serif text-3xl font-light text-[#f5f2eb] sm:text-4xl">
              Agreement signed.
            </h2>
            <p className="mt-3 text-base text-accent/90">
              Welcome to {PLATFORM_BRAND.name} — one more step to activate your
              membership.
            </p>

            <ul className="mt-8 space-y-3 text-left">
              <ChecklistItem>Your membership agreement is on file.</ChecklistItem>
              <ChecklistItem>
                Membership status:{" "}
                {onboardingStatus === "pending_payment"
                  ? "pending payment setup"
                  : "processing"}
              </ChecklistItem>
              <ChecklistItem>
                Add a card on file to activate billing and scheduling.
              </ChecklistItem>
            </ul>

            <button
              type="button"
              onClick={() => goToStep("payment")}
              className="mt-8 w-full rounded-lg bg-gradient-to-br from-accent to-[#e8d5a3] py-4 text-sm font-bold text-[#060606]"
            >
              Continue to payment method
            </button>
          </div>
        ) : null}

        {step === "payment" ? (
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] p-8 sm:p-10">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent/60">
              Why we keep a card on file
            </p>
            <h2 className="mt-2 font-serif text-3xl font-light text-[#f5f2eb]">
              Activate your membership
            </h2>
            <p className="mt-3 font-serif text-sm italic leading-relaxed text-accent/75">
              {MEMBERSHIP_BILLING_PHILOSOPHY}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              {MEMBERSHIP_CARD_ON_FILE_WHY}
            </p>

            <div className="mt-6">
              <CardOnFileSetup
                memberName={presentation.clientName}
                memberEmail={presentation.clientEmail}
                presentationId={presentation.id}
                membershipId={membershipId ?? undefined}
                theme="presentation"
                onBack={() => goToStep("welcome")}
                onSuccess={handlePaymentSuccess}
              />
            </div>
          </div>
        ) : null}

        {step === "complete" ? (
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] p-8 text-center sm:p-10">
            <h2 className="font-serif text-3xl font-light text-[#f5f2eb] sm:text-4xl">
              Your home is now under care.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              {presentation.clientName}, your membership is active. Your private
              portal is ready whenever you are.
            </p>

            <ul className="mt-8 space-y-3 text-left">
              <ChecklistItem>Agreement Complete</ChecklistItem>
              <ChecklistItem>Membership Active</ChecklistItem>
              <ChecklistItem>
                {paymentSaved ? "Card On File" : "Card On File — saved"}
              </ChecklistItem>
            </ul>

            {portalUrl ? (
              <a
                href={portalWelcomePathFromUrl(portalUrl)}
                className="mt-8 flex w-full min-h-[52px] items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#e8d5a3] py-4 text-sm font-bold text-[#060606]"
              >
                Open My Home
              </a>
            ) : null}

            <button
              type="button"
              onClick={handleDone}
              className={`w-full rounded-lg border border-white/20 py-4 text-sm font-medium text-[#f5f2eb] transition hover:border-white/40 ${
                portalUrl ? "mt-4" : "mt-8"
              }`}
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
