"use client";

import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { easePlan } from "@/components/home-care-plan/ui/primitives";
import {
  buildCheckoutPayload,
  getMembershipPlans,
} from "@/lib/membership/plans";
import {
  createMembershipCheckoutSession,
  redirectToStripeCheckout,
} from "@/lib/membership/checkout";
import type {
  CheckoutPhase,
  MembershipPlanId,
  MembershipSignature,
} from "@/lib/membership/types";
import { stripeCheckoutCapabilities } from "@/lib/membership/types";
import { useMembershipCheckout } from "./checkout-context";
import { useMembershipUnlock } from "./unlock-provider";
import { MembershipSignatureStep } from "./membership-signature-step";
import {
  unlockContextFromPlanData,
} from "@/lib/membership/unlock-sequence";

const steps = [
  "Select Plan",
  "Agreement",
  "Signature",
  "Checkout Preview",
  "Confirm",
] as const;

const agreementExcerpt = (propertyName: string) => `Home Care Membership Agreement

This agreement establishes an ongoing stewardship relationship between you and ${CUSTOMER_BRAND.name} for your property at ${propertyName}.

Members receive scheduled inspections, priority scheduling, documented property history, and member pricing on additional services.

Billing occurs monthly for the selected membership tier. You may cancel with thirty days written notice.

This is a placeholder agreement for demonstration purposes.`;

function NotActiveBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300/90">
      Not Active — Stripe Coming Soon
    </span>
  );
}

export function MembershipCheckoutModal() {
  const { isOpen, closeCheckout, planData } = useMembershipCheckout();
  const { beginMembershipUnlock } = useMembershipUnlock();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [selectedPlanId, setSelectedPlanId] =
    useState<MembershipPlanId>("preferred");
  const [savedSignature, setSavedSignature] =
    useState<MembershipSignature | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>("steps");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberships = getMembershipPlans(planData);
  const selectedPlan =
    memberships.find((m) => m.planId === selectedPlanId) ?? memberships[1];

  const reset = () => {
    setStep(0);
    setSavedSignature(null);
    setPhase("steps");
    setIsSubmitting(false);
    setSelectedPlanId("preferred");
  };

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const canContinue = () => {
    if (step === 2) return savedSignature !== null;
    return true;
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    }
  };

  const handleConfirmAndCheckout = async () => {
    setIsSubmitting(true);
    setPhase("redirecting");

    try {
      if (!savedSignature) return;

      const payload = buildCheckoutPayload(
        planData,
        selectedPlanId,
        savedSignature,
      );
      const session = await createMembershipCheckoutSession(payload);
      await redirectToStripeCheckout(session);
      closeCheckout();
      beginMembershipUnlock(
        unlockContextFromPlanData(planData, selectedPlan.name),
      );
    } catch {
      setPhase("steps");
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.35 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5"
          onClick={closeCheckout}
        >
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 32 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.45, ease: easePlan }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[94svh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background sm:max-h-[92svh] sm:rounded-[2rem]"
          >
            <div className="border-b border-border px-5 py-6 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-accent">
                  Become a Member
                </p>
                <button
                  type="button"
                  onClick={closeCheckout}
                  className="min-h-[44px] min-w-[44px] text-2xl leading-none text-muted"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {phase === "steps" && (
                <div className="mt-4 flex gap-1">
                  {steps.map((label, index) => (
                    <div
                      key={label}
                      className={`h-0.5 flex-1 rounded-full ${
                        index <= step ? "bg-accent" : "bg-border"
                      }`}
                      title={label}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-7 sm:px-8 sm:py-8">
              {phase === "redirecting" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-10 text-center"
                >
                  <NotActiveBadge />
                  <p className="mt-8 font-serif text-2xl font-light text-foreground">
                    Preparing secure checkout…
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    You&apos;ll complete payment on Stripe&apos;s secure page.
                  </p>
                  <motion.p
                    animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="mt-8 text-[11px] uppercase tracking-[0.28em] text-accent"
                  >
                    One moment
                  </motion.p>
                </motion.div>
              )}

              {phase === "steps" && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                    transition={{ duration: 0.3, ease: easePlan }}
                  >
                  {step === 0 && (
                    <div className="space-y-4">
                      <h2 className="font-serif text-2xl font-light text-foreground">
                        Select your membership
                      </h2>
                      {memberships.map((tier) => (
                        <button
                          key={tier.planId}
                          type="button"
                          onClick={() => setSelectedPlanId(tier.planId)}
                          className={`w-full rounded-2xl border p-5 text-left touch-manipulation ${
                            selectedPlanId === tier.planId
                              ? "border-accent/40 bg-accent/10"
                              : "border-border bg-surface"
                          }`}
                        >
                          <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                            {tier.name}
                          </p>
                          <p className="mt-2 font-serif text-2xl text-foreground">
                            {tier.price}{" "}
                            <span className="text-sm text-muted">{tier.period}</span>
                          </p>
                          <p className="mt-2 text-sm text-muted">{tier.lifestyle}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {step === 1 && (
                    <div>
                      <h2 className="font-serif text-2xl font-light text-foreground">
                        Home Care Membership Agreement
                      </h2>
                      <div className="mt-4 max-h-48 overflow-y-auto rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted whitespace-pre-line">
                        {agreementExcerpt(planData.property.name)}
                      </div>
                      <p className="mt-4 text-xs text-muted">
                        Placeholder agreement — legal review pending.
                      </p>
                    </div>
                  )}

                  {step === 2 && (
                    <MembershipSignatureStep
                      planData={planData}
                      planId={selectedPlanId}
                      planName={selectedPlan.name}
                      savedSignature={savedSignature}
                      onSignatureSaved={(signature) => setSavedSignature(signature)}
                      onSignatureCleared={() => setSavedSignature(null)}
                    />
                  )}

                  {step === 3 && (
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="font-serif text-2xl font-light text-foreground">
                          Secure checkout
                        </h2>
                        <NotActiveBadge />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted">
                        Payment is handled by{" "}
                        <span className="text-foreground">Stripe Checkout</span>{" "}
                        — not on this page. You will be redirected to a secure
                        Stripe-hosted page to complete enrollment.
                      </p>

                      <div className="mt-6 space-y-4">
                        {stripeCheckoutCapabilities.map((item) => (
                          <div
                            key={item.title}
                            className="rounded-2xl border border-border bg-surface/50 p-4"
                          >
                            <p className="text-sm font-medium text-foreground">
                              {item.title}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/30 p-5 text-center">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                          Stripe Checkout Preview
                        </p>
                        <p className="mt-2 font-serif text-lg text-foreground/60">
                          checkout.stripe.com
                        </p>
                        <p className="mt-3 text-xs text-muted">
                          Card entry happens on Stripe — never in {CUSTOMER_BRAND.name}
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div>
                      <h2 className="font-serif text-2xl font-light text-foreground">
                        Confirm &amp; continue
                      </h2>
                      <p className="mt-2 text-sm text-muted">
                        Review your selections. The next step redirects to Stripe
                        Checkout to complete enrollment.
                      </p>

                      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Plan</span>
                          <span className="text-foreground">{selectedPlan.name}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Rate</span>
                          <span className="text-foreground">
                            {selectedPlan.price} {selectedPlan.period}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Property</span>
                          <span className="text-right text-foreground">
                            {planData.property.name}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Signed by</span>
                          <span className="text-right text-foreground">
                            {savedSignature?.signerName}
                          </span>
                        </div>
                        {savedSignature && (
                          <>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted">Signed at</span>
                              <span className="text-right text-foreground">
                                {new Intl.DateTimeFormat("en-US", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }).format(new Date(savedSignature.signedAt))}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted">Signature</span>
                              <span className="capitalize text-foreground">
                                {savedSignature.method}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between gap-4 border-t border-border pt-3">
                          <span className="text-muted">Payment via</span>
                          <span className="text-foreground">Stripe Checkout</span>
                        </div>
                      </div>

                      <div className="mt-5 flex justify-center">
                        <NotActiveBadge />
                      </div>
                    </div>
                  )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {phase === "steps" && (
              <div className="border-t border-border px-5 py-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
                <div className="flex gap-3">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      disabled={isSubmitting}
                      className="min-h-[52px] flex-1 rounded-full border border-border text-sm tracking-[0.1em] text-foreground disabled:opacity-40"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canContinue() || isSubmitting}
                    onClick={
                      step === steps.length - 1
                        ? handleConfirmAndCheckout
                        : handleNext
                    }
                    className="min-h-[52px] flex-[2] rounded-full bg-accent text-sm font-medium tracking-[0.12em] text-background disabled:opacity-40"
                  >
                    {step === steps.length - 1
                      ? "Secure Checkout"
                      : "Continue"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
