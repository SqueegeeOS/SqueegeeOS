"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ServiceOption } from "@/lib/acquisition/types";
import { serviceOptions } from "@/lib/acquisition/types";
import {
  buildHomeCarePlanFromDraft,
  draftFromProperty,
  getPlanPresentationPath,
} from "@/lib/home-care-plan/builder";
import {
  emptyHomeCarePlanDraft,
  homeCarePlanWizardSteps,
  type HomeCarePlanDraft,
  type HomeCarePlanFindingDraft,
} from "@/lib/home-care-plan/create-types";
import { saveGeneratedHomeCarePlan } from "@/lib/persistence";
import { LocalStorageNotice } from "@/components/persistence/local-storage-notice";
import type { Property } from "@/lib/property/types";
import { AmbientGlow, Eyebrow, PageTitle, Reveal } from "@/components/property/ui/primitives";

const inputClassName =
  "w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-foreground placeholder:text-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

const labelClassName =
  "text-[11px] font-medium uppercase tracking-[0.24em] text-muted";

interface CreateHomeCarePlanWizardProps {
  initialDraft?: HomeCarePlanDraft;
  backHref?: string;
  backLabel?: string;
}

function createFindingId(): string {
  return `finding-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CreateHomeCarePlanWizard({
  initialDraft,
  backHref = "/employee",
  backLabel = "← Employee Dashboard",
}: CreateHomeCarePlanWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<HomeCarePlanDraft>(
    initialDraft ?? emptyHomeCarePlanDraft,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const previewPlan = useMemo(() => buildHomeCarePlanFromDraft(draft), [draft]);

  const updateHomeowner = (patch: Partial<HomeCarePlanDraft["homeowner"]>) => {
    setDraft((prev) => ({ ...prev, homeowner: { ...prev.homeowner, ...patch } }));
  };

  const updateProperty = (patch: Partial<HomeCarePlanDraft["property"]>) => {
    setDraft((prev) => ({ ...prev, property: { ...prev.property, ...patch } }));
  };

  const toggleService = (service: ServiceOption) => {
    setDraft((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };

  const addFinding = () => {
    setDraft((prev) => ({
      ...prev,
      findings: [
        ...prev.findings,
        {
          id: createFindingId(),
          title: "",
          severity: "Attention",
          description: "",
          image: "",
        },
      ],
    }));
  };

  const updateFinding = (
    id: string,
    patch: Partial<HomeCarePlanFindingDraft>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      findings: prev.findings.map((finding) =>
        finding.id === id ? { ...finding, ...patch } : finding,
      ),
    }));
  };

  const removeFinding = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      findings: prev.findings.filter((finding) => finding.id !== id),
    }));
  };

  const canContinue = () => {
    if (step === 0) return draft.homeowner.fullName.trim().length > 2;
    if (step === 1) {
      return (
        draft.property.name.trim().length > 1 &&
        draft.property.address.trim().length > 3
      );
    }
    if (step === 2) {
      return draft.services.length > 0 || draft.findings.length > 0;
    }
    return true;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setSaveNotice(null);

    try {
      const plan = buildHomeCarePlanFromDraft(draft);
      const outcome = await saveGeneratedHomeCarePlan(plan, draft);

      if (outcome.usedCloudFallback) {
        setSaveNotice(
          outcome.cloudError
            ? `Cloud save failed: ${outcome.cloudError} Plan saved in this browser and will open now.`
            : "Cloud save failed. Plan saved in this browser and will open now.",
        );
        await new Promise((resolve) => setTimeout(resolve, 1400));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      router.push(getPlanPresentationPath(plan));
    } catch (error) {
      console.error("[home-care-plan] Generate failed:", error);
      setGenerateError(
        error instanceof Error
          ? error.message
          : "Could not save this plan. Please try again.",
      );
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <AmbientGlow />

      <div className="relative mx-auto max-w-2xl px-5 pb-32 pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-8 sm:pb-36 sm:pt-16">
        <Reveal>
          <Link
            href={backHref}
            className="text-[11px] uppercase tracking-[0.28em] text-muted transition-colors hover:text-accent"
          >
            {backLabel}
          </Link>
        </Reveal>

        <Reveal delay={0.06} className="mt-8">
          <Eyebrow>Proposal Generator</Eyebrow>
          <PageTitle className="mt-5">Create Home Care Plan</PageTitle>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            Enter homeowner and property details. Generate a personalized plan
            using the flagship presentation design.
          </p>
          <LocalStorageNotice className="mt-4" />
        </Reveal>

        <Reveal delay={0.1} className="mt-8">
          <div className="flex gap-1">
            {homeCarePlanWizardSteps.map((label, index) => (
              <div
                key={label}
                className={`h-0.5 flex-1 rounded-full ${
                  index <= step ? "bg-accent" : "bg-border"
                }`}
                title={label}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-muted">
            Step {step + 1} — {homeCarePlanWizardSteps[step]}
          </p>
        </Reveal>

        <Reveal delay={0.14} className="mt-8">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl font-light text-foreground">
                Homeowner
              </h2>
              <label className="block">
                <span className={labelClassName}>Full name</span>
                <input
                  type="text"
                  value={draft.homeowner.fullName}
                  onChange={(e) => updateHomeowner({ fullName: e.target.value })}
                  placeholder="Larry Buckley"
                  className={`${inputClassName} mt-2`}
                />
              </label>
              <label className="block">
                <span className={labelClassName}>Email</span>
                <input
                  type="email"
                  value={draft.homeowner.email}
                  onChange={(e) => updateHomeowner({ email: e.target.value })}
                  placeholder="homeowner@email.com"
                  className={`${inputClassName} mt-2`}
                />
              </label>
              <label className="block">
                <span className={labelClassName}>Phone</span>
                <input
                  type="tel"
                  value={draft.homeowner.phone}
                  onChange={(e) => updateHomeowner({ phone: e.target.value })}
                  placeholder="(530) 555-0100"
                  className={`${inputClassName} mt-2`}
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl font-light text-foreground">
                Property
              </h2>
              <label className="block">
                <span className={labelClassName}>Property name</span>
                <input
                  type="text"
                  value={draft.property.name}
                  onChange={(e) => updateProperty({ name: e.target.value })}
                  placeholder="Canyon Oaks Residence"
                  className={`${inputClassName} mt-2`}
                />
              </label>
              <label className="block">
                <span className={labelClassName}>Street address</span>
                <input
                  type="text"
                  value={draft.property.address}
                  onChange={(e) => updateProperty({ address: e.target.value })}
                  placeholder="4125 Canyon Oaks Drive"
                  className={`${inputClassName} mt-2`}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className={labelClassName}>City</span>
                  <input
                    type="text"
                    value={draft.property.city}
                    onChange={(e) => updateProperty({ city: e.target.value })}
                    className={`${inputClassName} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>ZIP</span>
                  <input
                    type="text"
                    value={draft.property.zip}
                    onChange={(e) => updateProperty({ zip: e.target.value })}
                    className={`${inputClassName} mt-2`}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClassName}>State</span>
                  <input
                    type="text"
                    value={draft.property.state}
                    onChange={(e) => updateProperty({ state: e.target.value })}
                    className={`${inputClassName} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Property type</span>
                  <input
                    type="text"
                    value={draft.property.propertyType}
                    onChange={(e) =>
                      updateProperty({ propertyType: e.target.value })
                    }
                    className={`${inputClassName} mt-2`}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={labelClassName}>Year built</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.property.yearBuilt}
                    onChange={(e) =>
                      updateProperty({ yearBuilt: e.target.value })
                    }
                    className={`${inputClassName} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Home Care Score</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.property.homeCareScore}
                    onChange={(e) =>
                      updateProperty({ homeCareScore: e.target.value })
                    }
                    className={`${inputClassName} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Last visit</span>
                  <input
                    type="text"
                    value={draft.property.lastVisit}
                    onChange={(e) =>
                      updateProperty({ lastVisit: e.target.value })
                    }
                    placeholder="June 24, 2026"
                    className={`${inputClassName} mt-2`}
                  />
                </label>
              </div>
              <label className="block">
                <span className={labelClassName}>Hero image URL (optional)</span>
                <input
                  type="url"
                  value={draft.property.heroImage}
                  onChange={(e) => updateProperty({ heroImage: e.target.value })}
                  placeholder="https://..."
                  className={`${inputClassName} mt-2`}
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-light text-foreground">
                  Services &amp; findings
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Select services from the inspection. Add custom findings or
                  let the plan generate findings from your selections.
                </p>
              </div>

              <div>
                <p className={labelClassName}>Services</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {serviceOptions.map((service) => {
                    const selected = draft.services.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`min-h-[44px] rounded-full border px-4 py-2 text-sm touch-manipulation ${
                          selected
                            ? "border-accent/40 bg-accent/10 text-foreground"
                            : "border-border bg-surface text-muted"
                        }`}
                      >
                        {service}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <p className={labelClassName}>Custom findings (optional)</p>
                  <button
                    type="button"
                    onClick={addFinding}
                    className="text-sm text-accent"
                  >
                    + Add finding
                  </button>
                </div>

                {draft.findings.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    No custom findings — selected services will become
                    &quot;What We Found&quot; cards in the plan.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {draft.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="rounded-2xl border border-border bg-surface p-4"
                      >
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeFinding(finding.id)}
                            className="text-xs text-muted hover:text-foreground"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-2 space-y-3">
                          <input
                            type="text"
                            value={finding.title}
                            onChange={(e) =>
                              updateFinding(finding.id, { title: e.target.value })
                            }
                            placeholder="Finding title"
                            className={inputClassName}
                          />
                          <input
                            type="text"
                            value={finding.severity}
                            onChange={(e) =>
                              updateFinding(finding.id, {
                                severity: e.target.value,
                              })
                            }
                            placeholder="Severity (e.g. Attention)"
                            className={inputClassName}
                          />
                          <textarea
                            value={finding.description}
                            onChange={(e) =>
                              updateFinding(finding.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder="Description for the customer presentation"
                            rows={3}
                            className={`${inputClassName} resize-y`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl font-light text-foreground">
                Notes &amp; recommendation
              </h2>

              <label className="block">
                <span className={labelClassName}>Property health rating</span>
                <select
                  value={draft.propertyHealthRating}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      propertyHealthRating: e.target.value,
                    }))
                  }
                  className={`${inputClassName} mt-2`}
                >
                  {[
                    "Excellent",
                    "Well Maintained",
                    "Needs Attention",
                    "Under Review",
                  ].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelClassName}>Property health narrative</span>
                <textarea
                  value={draft.propertyHealthNarrative}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      propertyHealthNarrative: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Narrative for the property snapshot section..."
                  className={`${inputClassName} mt-2 resize-y`}
                />
              </label>

              <label className="block">
                <span className={labelClassName}>Recommendation headline</span>
                <input
                  type="text"
                  value={draft.recommendationHeadline}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      recommendationHeadline: e.target.value,
                    }))
                  }
                  className={`${inputClassName} mt-2`}
                />
              </label>

              <label className="block">
                <span className={labelClassName}>
                  Recommendation body (one paragraph per line)
                </span>
                <textarea
                  value={draft.recommendationBody}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      recommendationBody: e.target.value,
                    }))
                  }
                  rows={4}
                  className={`${inputClassName} mt-2 resize-y`}
                />
              </label>

              <label className="block">
                <span className={labelClassName}>Personal note greeting</span>
                <input
                  type="text"
                  value={draft.personalNoteGreeting}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      personalNoteGreeting: e.target.value,
                    }))
                  }
                  placeholder="Larry,"
                  className={`${inputClassName} mt-2`}
                />
              </label>

              <label className="block">
                <span className={labelClassName}>
                  Personal note (one paragraph per line)
                </span>
                <textarea
                  value={draft.personalNoteBody}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      personalNoteBody: e.target.value,
                    }))
                  }
                  rows={4}
                  className={`${inputClassName} mt-2 resize-y`}
                />
              </label>

              <label className="block">
                <span className={labelClassName}>Internal notes (Noah only)</span>
                <textarea
                  value={draft.internalNotes}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      internalNotes: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Not shown on customer plan — for your reference only."
                  className={`${inputClassName} mt-2 resize-y`}
                />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl font-light text-foreground">
                Pricing
              </h2>
              <p className="text-sm text-muted">
                Set membership pricing for this presentation. Amounts appear on
                the customer-facing plan.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={labelClassName}>One-time ($)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.membershipOneTimePrice}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        membershipOneTimePrice: e.target.value.replace(
                          /[^\d]/g,
                          "",
                        ),
                      }))
                    }
                    className={`${inputClassName} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Preferred / mo ($)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.membershipPreferredPrice}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        membershipPreferredPrice: e.target.value.replace(
                          /[^\d]/g,
                          "",
                        ),
                      }))
                    }
                    className={`${inputClassName} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Estate / mo ($)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.membershipEstatePrice}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        membershipEstatePrice: e.target.value.replace(
                          /[^\d]/g,
                          "",
                        ),
                      }))
                    }
                    className={`${inputClassName} mt-2`}
                  />
                </label>
              </div>

              <div>
                <p className={labelClassName}>Recommended tier</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["one-time", "One-Time Refresh"],
                      ["preferred", "Preferred Care"],
                      ["estate", "Estate Care"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, recommendedTier: id }))
                      }
                      className={`min-h-[44px] rounded-full border px-4 py-2 text-sm touch-manipulation ${
                        draft.recommendedTier === id
                          ? "border-accent/40 bg-accent/10 text-foreground"
                          : "border-border bg-surface text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="font-serif text-2xl font-light text-foreground">
                Generate plan
              </h2>
              <p className="text-sm text-muted">
                Review the summary below. Generating saves the plan to cloud
                storage and opens the customer presentation.
              </p>

              <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Homeowner</span>
                  <span className="text-right text-foreground">
                    {previewPlan.homeowner.fullName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Property</span>
                  <span className="text-right text-foreground">
                    {previewPlan.property.name}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Services</span>
                  <span className="text-right text-foreground">
                    {draft.services.length || "From findings"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Recommended</span>
                  <span className="text-foreground">
                    {previewPlan.property.membershipRecommendation}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <span className="text-muted">Presentation URL</span>
                  <span className="text-right text-xs text-foreground/80">
                    {getPlanPresentationPath(previewPlan)}
                  </span>
                </div>
              </div>

              {draft.internalNotes.trim() && (
                <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-4">
                  <p className={labelClassName}>Internal notes</p>
                  <p className="mt-2 text-sm text-muted">{draft.internalNotes}</p>
                </div>
              )}
            </div>
          )}
        </Reveal>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          {(generateError || saveNotice) && (
            <div className="mx-auto mb-3 max-w-2xl space-y-2">
              {generateError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200"
                >
                  {generateError}
                </div>
              )}
              {saveNotice && (
                <div
                  role="status"
                  className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100/90"
                >
                  {saveNotice}
                </div>
              )}
            </div>
          )}
          <div className="mx-auto flex max-w-2xl gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={isGenerating}
                className="min-h-[52px] flex-1 rounded-full border border-border text-sm tracking-[0.1em] text-foreground disabled:opacity-40"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={!canContinue() || isGenerating}
              onClick={() => {
                if (step === homeCarePlanWizardSteps.length - 1) {
                  void handleGenerate();
                  return;
                }
                setStep((s) => s + 1);
              }}
              className="min-h-[52px] flex-[2] rounded-full bg-accent text-sm font-medium tracking-[0.12em] text-background disabled:opacity-40"
            >
              {step === homeCarePlanWizardSteps.length - 1
                ? isGenerating
                  ? "Crafting plan…"
                  : "Generate Plan"
                : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreateHomeCarePlanWizardFromProperty({
  property,
  homeowner,
}: {
  property: Property;
  homeowner: { fullName: string; firstName: string; email: string };
}) {
  const initialDraft = useMemo(
    () => draftFromProperty(property, homeowner),
    [property, homeowner],
  );

  return (
    <CreateHomeCarePlanWizard
      initialDraft={initialDraft}
      backHref={`/properties/${property.slug}`}
      backLabel={`← ${property.name}`}
    />
  );
}
