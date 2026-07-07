"use client";

import { useState, type ReactNode } from "react";
import { AgreementSignaturePad } from "@/components/agreement/agreement-signature-pad";
import { CardOnFileSetup } from "@/components/membership/card-on-file-setup";
import {
  MEMBERSHIP_BILLING_PHILOSOPHY,
  MEMBERSHIP_BILLING_SCHEDULE_BODY,
  MEMBERSHIP_BILLING_SCHEDULE_HEADLINE,
  MEMBERSHIP_CARD_ON_FILE_WHY,
  MEMBERSHIP_CONFIRMATION_PHILOSOPHY,
  MEMBERSHIP_NEXT_BILLING_LABEL,
  membershipAgreementCheckboxText,
} from "@/lib/agreement/agreement-content";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { cachePresentation } from "@/lib/presentations/client-cache";
import {
  computePresentationRates,
  slugifyPresentation,
  visitRateFromPresentation,
} from "@/lib/presentations/calculations";
import {
  tierLabel,
  tierTagline,
  type PresentationData,
  type PresentationTier,
} from "@/lib/presentations/types";
import {
  calculateAnnualFromVisits,
  formatTierPrice,
  planNameForAgreement,
  SQUEEGEEKING_TIERS,
} from "@/lib/membership/tier-config";
import type { MembershipPlanId } from "@/lib/membership/types";

type OnboardingStep = "sign" | "welcome" | "payment" | "complete";

function tierToPlanId(_tier: PresentationTier): MembershipPlanId {
  return "preferred";
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
}: {
  presentation: PresentationData;
  selectedTier: PresentationTier;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<OnboardingStep>("sign");
  const [tier, setTier] = useState<PresentationTier>(selectedTier);
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSaved, setPaymentSaved] = useState(false);

  const rates = computePresentationRates({ ...presentation, tier });
  const visitPrice =
    tier === presentation.tier
      ? visitRateFromPresentation(presentation)
      : tier === "biannual"
        ? rates.biannualVisit
        : rates.quarterlyVisit;
  const annualTotal = calculateAnnualFromVisits(tier, visitPrice);

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
        error?: string;
      } | null;

      if (!signRes.ok) {
        throw new Error(signBody?.error ?? "Signing failed");
      }

      const signedPresentation: PresentationData = {
        ...presentation,
        status: "signed",
        signedAt,
        agreementId: signBody?.agreementId ?? "",
        tier,
        monthlyRate: visitPrice,
        annualRate: annualTotal,
      };
      cachePresentation(signedPresentation);

      await fetch(`/api/presentations/${presentation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signedPresentation),
      });

      setStep("welcome");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
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
            <p className="text-4xl">🎉</p>
            <h2 className="mt-5 font-serif text-3xl font-light text-[#f5f2eb] sm:text-4xl">
              Welcome to {PLATFORM_BRAND.name}!
            </h2>
            <p className="mt-3 text-base text-accent/90">
              You&apos;re officially a {PLATFORM_BRAND.name} member.
            </p>

            <ul className="mt-8 space-y-3 text-left">
              <ChecklistItem>Your membership is active.</ChecklistItem>
              <ChecklistItem>
                We&apos;ll contact you before each scheduled service.
              </ChecklistItem>
              <ChecklistItem>
                Your home&apos;s history will now be maintained in{" "}
                {PLATFORM_BRAND.name}.
              </ChecklistItem>
            </ul>

            <button
              type="button"
              onClick={() => setStep("payment")}
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
              Complete your membership
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
                theme="presentation"
                onBack={() => setStep("welcome")}
                onSuccess={() => {
                  setPaymentSaved(true);
                  setStep("complete");
                }}
              />
            </div>
          </div>
        ) : null}

        {step === "complete" ? (
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] p-8 text-center sm:p-10">
            <h2 className="font-serif text-3xl font-light text-[#f5f2eb] sm:text-4xl">
              You&apos;re all set!
            </h2>
            <p className="mt-3 text-sm text-white/45">
              {presentation.clientName}, welcome to the family.
            </p>

            <ul className="mt-8 space-y-3 text-left">
              <ChecklistItem>Membership Active</ChecklistItem>
              <ChecklistItem>
                {paymentSaved
                  ? "Payment Method Saved"
                  : "Payment Method — add from your member portal anytime"}
              </ChecklistItem>
              <ChecklistItem>
                Next billing: {MEMBERSHIP_NEXT_BILLING_LABEL}
              </ChecklistItem>
              <ChecklistItem>We&apos;ll contact you before each visit.</ChecklistItem>
            </ul>

            <p className="mt-6 text-left text-sm italic leading-relaxed text-white/45">
              {MEMBERSHIP_CONFIRMATION_PHILOSOPHY}
            </p>

            <button
              type="button"
              onClick={onDone}
              className="mt-8 w-full rounded-lg border border-white/20 py-4 text-sm font-medium text-[#f5f2eb] transition hover:border-white/40"
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
