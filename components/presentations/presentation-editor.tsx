"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cachePresentation } from "@/lib/presentations/client-cache";
import {
  computePresentationRates,
  applyTierVisitOverride,
  tierVisitOverride,
  visitRateFromPresentation,
  withComputedRates,
} from "@/lib/presentations/calculations";
import { defaultEnrollmentSavingsForTier } from "@/lib/membership/enrollment-savings";
import {
  buildExteriorWindowBreakdown,
  DEFAULT_COMPANY_SETTINGS,
} from "@/lib/pricing/window-care-pricing";
import {
  getPresentationSlides,
  tierLabel,
  type PresentationData,
  type SlideOverride,
  type SlideType,
} from "@/lib/presentations/types";
import {
  calculateVisitPrice,
  formatTierPrice,
} from "@/lib/membership/tier-config";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  CollapsibleSection,
  EditorField,
  EditorTextArea,
  EditorTextInput,
  SlideOverrideAccordion,
  TierPicker,
} from "./presentation-editor-kit";
import { PresentationAddressEditor } from "./presentation-address-editor";
import { PresentationPlanStudio } from "./presentation-plan-studio";
import {
  createDefaultCarePlan,
  resizeCarePlan,
  summarizeCarePlan,
} from "@/lib/presentations/care-plan";

export function PresentationEditor({
  presentation: initial,
  recoveredDraft = false,
}: {
  presentation: PresentationData;
  recoveredDraft?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const dataRef = useRef(initial);
  const editRevisionRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(recoveredDraft);
  const [showRecoveredNotice, setShowRecoveredNotice] =
    useState(recoveredDraft);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    recoveredDraft ? null : initial.updatedAt,
  );

  const slides = useMemo(() => getPresentationSlides(data), [data]);
  const editableSlides = useMemo(
    () => slides.filter((slide) => slide.editable.length > 0),
    [slides],
  );
  const rates = useMemo(() => computePresentationRates(data), [data]);
  const visitRate = visitRateFromPresentation(data);
  const tierOverride = tierVisitOverride(data, data.tier) ?? 0;
  const isSigned = data.status === "signed";

  useEffect(() => {
    cachePresentation(data);
  }, [data]);

  useEffect(() => {
    if (!isDirty) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  const twoStory = data.twoStory;
  const includeScreens = data.includeScreens;
  const includeInterior = data.includeInterior;

  const recalculateVisitRate = (
    prev: PresentationData,
    patch: Partial<PresentationData>,
  ): PresentationData => {
    const merged = { ...prev, ...patch };
    return {
      ...merged,
      ...withComputedRates(merged),
    };
  };

  const commitEdit = (
    updater: (current: PresentationData) => PresentationData,
  ) => {
    const next = {
      ...updater(dataRef.current),
      updatedAt: new Date().toISOString(),
    };
    dataRef.current = next;
    editRevisionRef.current += 1;
    setData(next);
    setIsDirty(true);
    setError(null);
  };

  const setPricingOption = (
    patch: Partial<{
      twoStory: boolean;
      includeScreens: boolean;
      includeInterior: boolean;
    }>,
  ) => {
    commitEdit((prev) => {
      const nextFlags = {
        twoStory: patch.twoStory ?? prev.twoStory,
        includeScreens: patch.includeScreens ?? prev.includeScreens,
        includeInterior: patch.includeInterior ?? prev.includeInterior,
      };
      return recalculateVisitRate(prev, {
        ...nextFlags,
        carePlan:
          prev.planMode === "simple"
            ? createDefaultCarePlan({
                tier: prev.tier,
                includeScreens: nextFlags.includeScreens,
                includeInterior: nextFlags.includeInterior,
              })
            : prev.carePlan,
      });
    });
  };

  const setPlanStudioOptions = (patch: Partial<PresentationData>) => {
    commitEdit((prev) => {
      const nextTier = patch.tier ?? prev.tier;
      const mergedPatch = {
        ...patch,
        carePlan: patch.carePlan
          ? patch.carePlan
          : nextTier !== prev.tier
            ? resizeCarePlan(prev.carePlan, nextTier)
            : prev.carePlan,
      };
      return recalculateVisitRate(prev, mergedPatch);
    });
  };

  const exteriorBreakdown =
    data.homeSqft > 0
      ? data.tier === "triannual"
        ? (() => {
            const visitTotal = calculateVisitPrice("triannual", data.homeSqft, {
              twoStory,
              includeScreens,
            });
            const twoStorySurcharge = twoStory
              ? DEFAULT_COMPANY_SETTINGS.twoStorySurcharge
              : 0;
            const screenCleaning = includeScreens
              ? DEFAULT_COMPANY_SETTINGS.screenCleaningAddOn
              : 0;
            return {
              sqftBase: visitTotal - twoStorySurcharge - screenCleaning,
              twoStorySurcharge,
              screenCleaning,
              visitTotal,
            };
          })()
        : buildExteriorWindowBreakdown(
            data.homeSqft,
            data.tier === "quarterly" ? "quarterly" : "bi_annual",
            { twoStory, includeScreens },
          )
      : null;
  const interiorCleaning = includeInterior
    ? DEFAULT_COMPANY_SETTINGS.interiorCleaningAddOn
    : 0;

  const update = <K extends keyof PresentationData>(
    field: K,
    value: PresentationData[K],
  ) => {
    commitEdit((prev) => {
      if (field === "tier") {
        const nextTier = value as PresentationData["tier"];
        return recalculateVisitRate(prev, {
          tier: nextTier,
          carePlan: resizeCarePlan(prev.carePlan, nextTier),
          retailValue: nextTier === "quarterly" ? prev.retailValue : 0,
          enrollmentSavings: defaultEnrollmentSavingsForTier(nextTier),
        });
      }
      if (field === "homeSqft") {
        return recalculateVisitRate(prev, { [field]: value } as Partial<PresentationData>);
      }
      if (field === "monthlyRate") {
        const patched = {
          ...prev,
          ...applyTierVisitOverride(
            prev,
            prev.tier,
            Number.parseFloat(String(value)) || 0,
          ),
        };
        return { ...patched, ...withComputedRates(patched) };
      }
      if (field === "retailValue") {
        const patched = { ...prev, retailValue: value as number };
        return { ...patched, ...withComputedRates(patched) };
      }
      return { ...prev, [field]: value };
    });
  };

  const setSlideOverride = (
    slideId: SlideType,
    field: keyof SlideOverride,
    value: string,
  ) => {
    commitEdit((prev) => ({
      ...prev,
      slideOverrides: {
        ...prev.slideOverrides,
        [slideId]: {
          ...prev.slideOverrides?.[slideId],
          [field]: value,
        },
      },
    }));
  };

  const save = async (): Promise<boolean> => {
    const snapshot = dataRef.current;
    const editRevision = editRevisionRef.current;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/presentations/${snapshot.id}`, {
        method: "PATCH",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify(snapshot),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Could not save. Try again.");
        return false;
      }
      const json = (await res.json()) as { presentation: PresentationData };
      if (editRevisionRef.current !== editRevision) {
        // The request saved its snapshot, but the user typed again while it was
        // in flight. Never replace those newer edits with the older response.
        cachePresentation(dataRef.current);
        setIsDirty(true);
        return false;
      }
      dataRef.current = json.presentation;
      setData(json.presentation);
      cachePresentation(json.presentation);
      setIsDirty(false);
      setShowRecoveredNotice(false);
      setLastSavedAt(json.presentation.updatedAt);
      return true;
    } catch {
      setError("Could not save. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const present = async () => {
    setPresenting(true);
    setError(null);
    try {
      cachePresentation(dataRef.current);
      const saved = await save();
      if (!saved) return;
      router.push(`/presentations/${dataRef.current.id}/present`);
    } finally {
      setPresenting(false);
    }
  };

  const readyToPresent =
    data.clientName.trim().length > 0 && data.clientAddress.trim().length > 0;

  const pricingSummary =
    data.planMode === "custom"
      ? summarizeCarePlan(data.carePlan)
      : data.homeSqft > 0
      ? `${data.homeSqft.toLocaleString()} sq ft`
      : "Standard pricing";

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-36 text-white">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link
          href="/presentations"
          onClick={(event) => {
            if (
              isDirty &&
              !window.confirm(
                "This draft has unsaved changes. Leave without saving?",
              )
            ) {
              event.preventDefault();
            }
          }}
          className="mb-6 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#444] transition-colors hover:text-[#888]"
        >
          ← Presentations
        </Link>

        <header className="mb-8">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[#555]">
            Field presentation
          </p>
          <h1 className="font-serif text-2xl text-white">
            {data.clientName.trim() || "New client"}
          </h1>
          <p className="mt-1 text-sm text-[#666]">
            {data.clientAddress.trim() || "Add the property address below"}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-[#c9a96e]">
              {data.planMode === "custom" ? "Avg " : ""}
              {formatTierPrice(visitRate)}/visit
            </span>
            <span className="text-[#333]">·</span>
            <span className="text-[#888]">
              {formatTierPrice(data.annualRate)}/yr
            </span>
            <span className="text-[#333]">·</span>
            <span className="text-[#666]">{tierLabel(data.tier)}</span>
          </div>
        </header>

        <div className="space-y-6">
          <section>
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#444]">
              Before you present
            </p>
            <div className="space-y-4 rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4">
              <EditorField label="Client name">
                <EditorTextInput
                  value={data.clientName}
                  name="name"
                  autoComplete="name"
                  placeholder="Larry Buckley"
                  onChange={(v) => update("clientName", v)}
                />
              </EditorField>
              <PresentationAddressEditor
                value={data.clientAddress}
                onChange={(value) => update("clientAddress", value)}
              />
            </div>
          </section>

          <section>
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#444]">
              Recommended care plan
            </p>
            <TierPicker
              value={data.tier}
              onChange={(tier) => update("tier", tier)}
            />
            {data.tier === "quarterly" ? (
              <p className="mt-3 text-[11px] leading-relaxed text-[#555]">
                Quarterly includes RainBlock + Hard Water protection on every
                visit.
              </p>
            ) : data.tier === "triannual" ? (
              <p className="mt-3 text-[11px] leading-relaxed text-[#555]">
                Optional 3× per year cadence · one visit every four months ·
                20% off add-ons.
              </p>
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-[#555]">
                Bi-Annual includes 20% off add-ons. RainBlock and Hard Water are
                not included — available as add-on services.
              </p>
            )}
          </section>

          <PresentationPlanStudio
            presentation={data}
            onChange={setPlanStudioOptions}
          />

          <CollapsibleSection
            title="Home size & visit rate"
            summary={pricingSummary}
            defaultOpen={data.homeSqft <= 0}
          >
            <EditorField
              label="Home square footage"
              hint="Standard visit rate is calculated from sq ft and options below."
            >
              <EditorTextInput
                type="number"
                inputMode="numeric"
                value={data.homeSqft > 0 ? String(data.homeSqft) : ""}
                placeholder="e.g. 2800"
                onChange={(v) => {
                  const homeSqft = Number.parseInt(v, 10) || 0;
                  commitEdit((prev) =>
                    recalculateVisitRate(prev, { homeSqft }),
                  );
                }}
              />
            </EditorField>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPricingOption({ twoStory: !twoStory })}
                aria-pressed={twoStory}
                className="rounded-lg border px-3 py-2 text-xs transition-colors"
                style={{
                  borderColor: twoStory ? "#c9a96e55" : "#222",
                  color: twoStory ? "#c9a96e" : "#555",
                  backgroundColor: twoStory ? "#141008" : "#111",
                }}
              >
                Two-story (+$100)
              </button>
              {data.planMode === "simple" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setPricingOption({ includeScreens: !includeScreens })
                    }
                    aria-pressed={includeScreens}
                    className="rounded-lg border px-3 py-2 text-xs transition-colors"
                    style={{
                      borderColor: includeScreens ? "#c9a96e55" : "#222",
                      color: includeScreens ? "#c9a96e" : "#777",
                      backgroundColor: includeScreens ? "#141008" : "#111",
                    }}
                  >
                    Screens (+$50 every visit)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPricingOption({ includeInterior: !includeInterior })
                    }
                    aria-pressed={includeInterior}
                    className="rounded-lg border px-3 py-2 text-xs transition-colors"
                    style={{
                      borderColor: includeInterior ? "#c9a96e55" : "#222",
                      color: includeInterior ? "#c9a96e" : "#777",
                      backgroundColor: includeInterior ? "#141008" : "#111",
                    }}
                  >
                    Interior (+$
                    {DEFAULT_COMPANY_SETTINGS.interiorCleaningAddOn} every visit)
                  </button>
                </>
              ) : (
                <p className="w-full rounded-xl border border-[#c9a96e]/15 bg-[#c9a96e]/[0.04] px-3 py-2.5 text-xs leading-relaxed text-[#c9a96e]/75">
                  Interior and screens are priced visit-by-visit in Atlas Plan Studio.
                </p>
              )}
            </div>

            {data.planMode === "custom" && rates.carePlanPricing ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#111] px-3 py-3 text-xs text-white/55">
                {rates.carePlanPricing.visits.map((visit) => (
                  <p key={visit.id} className="flex justify-between gap-4 py-1">
                    <span>{visit.label}</span>
                    <span className="text-white/80">
                      {formatTierPrice(visit.total)}
                    </span>
                  </p>
                ))}
                <p className="mt-2 flex justify-between border-t border-white/[0.08] pt-2 text-[#c9a96e]">
                  <span>Estimated annual plan</span>
                  <span>{formatTierPrice(rates.carePlanPricing.annualTotal)}</span>
                </p>
              </div>
            ) : exteriorBreakdown ? (
              <div className="rounded-lg bg-[#111] px-3 py-2.5 text-[11px] text-[#555]">
                <p className="flex justify-between">
                  <span>Sq ft base</span>
                  <span>${exteriorBreakdown.sqftBase}</span>
                </p>
                {exteriorBreakdown.twoStorySurcharge > 0 ? (
                  <p className="mt-1 flex justify-between">
                    <span>Two-story</span>
                    <span>+${exteriorBreakdown.twoStorySurcharge}</span>
                  </p>
                ) : null}
                {exteriorBreakdown.screenCleaning > 0 ? (
                  <p className="mt-1 flex justify-between">
                    <span>Screens</span>
                    <span>+${exteriorBreakdown.screenCleaning}</span>
                  </p>
                ) : null}
                {interiorCleaning > 0 ? (
                  <p className="mt-1 flex justify-between">
                    <span>Interior cleaning</span>
                    <span>+${interiorCleaning}</span>
                  </p>
                ) : null}
                <p className="mt-1.5 flex justify-between border-t border-[#1a1a1a] pt-1.5 text-[#888]">
                  <span>Per visit</span>
                  <span>${exteriorBreakdown.visitTotal + interiorCleaning}</span>
                </p>
              </div>
            ) : null}

            <EditorField
              label="Enrollment Savings"
              hint="Per-visit savings vs one-time at enrollment. Locked into the agreement and membership at activation."
            >
              {isSigned ? (
                <p className="text-sm text-[#888]">
                  {formatTierPrice(
                    data.enrollmentSavings || rates.enrollmentSavings,
                  )}{" "}
                  · locked at signing
                </p>
              ) : (
                <EditorTextInput
                  type="number"
                  inputMode="decimal"
                  value={String(
                    data.enrollmentSavings || rates.enrollmentSavings,
                  )}
                  onChange={(v) =>
                    update(
                      "enrollmentSavings",
                      Number.parseFloat(v) ||
                        defaultEnrollmentSavingsForTier(data.tier),
                    )
                  }
                />
              )}
            </EditorField>

            <EditorField
              label={
                data.planMode === "custom"
                  ? "Exterior base-rate override"
                  : "Per-visit rate override"
              }
              hint={
                data.planMode === "custom"
                  ? "Optional base before the $100 interior and $50 screen add-ons. Use each visit's exact-price field when the final totals differ."
                  : "Optional. Standard pricing applies when blank."
              }
            >
              <EditorTextInput
                type="number"
                inputMode="decimal"
                value={tierOverride > 0 ? String(tierOverride) : ""}
                placeholder={String(
                  Math.round(
                    data.tier === "biannual"
                      ? rates.biannualVisit
                      : data.tier === "triannual"
                        ? rates.triannualVisit
                        : rates.quarterlyVisit,
                  ),
                )}
                onChange={(v) =>
                  update("monthlyRate", Number.parseFloat(v) || 0)
                }
              />
            </EditorField>
          </CollapsibleSection>

          {data.tier === "quarterly" ? (
            <CollapsibleSection
              title="Quarterly treatment value"
              summary="RainBlock + Hard Water retail value"
              defaultOpen={false}
            >
              <EditorField
                label="Added treatment value (Quarterly slide)"
                hint="Retail value of RainBlock + Hard Water included with Quarterly — not the plan price. Shown on The Math slide only."
              >
                <EditorTextInput
                  type="number"
                  inputMode="decimal"
                  value={data.retailValue > 0 ? String(data.retailValue) : ""}
                  placeholder={String(rates.retailValue)}
                  onChange={(v) =>
                    update("retailValue", Number.parseFloat(v) || 0)
                  }
                />
              </EditorField>
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection
            title="Closing slide note"
            summary={
              data.customNotes.trim()
                ? data.customNotes.trim()
                : "Optional personal note on the final slide"
            }
          >
            <EditorField label="What to say when you close">
              <EditorTextArea
                value={data.customNotes}
                placeholder="Your home is in great shape — quarterly care would keep it that way…"
                rows={4}
                onChange={(v) => update("customNotes", v)}
              />
            </EditorField>
          </CollapsibleSection>

          <CollapsibleSection
            title="Agreement email"
            summary={
              data.clientEmail.trim() || "Needed when the customer signs"
            }
          >
            <EditorField
              label="Customer email"
              hint="Collected at signing. You can add this after the presentation if needed."
            >
              <EditorTextInput
                type="email"
                inputMode="email"
                name="email"
                autoComplete="email"
                value={data.clientEmail}
                placeholder="client@email.com"
                onChange={(v) => update("clientEmail", v)}
              />
            </EditorField>
          </CollapsibleSection>

          <CollapsibleSection
            title="Customize slide copy"
            summary={`${editableSlides.length} slides · office / advanced`}
          >
            <p className="text-[11px] leading-relaxed text-[#555]">
              Default slides work for most driveway presentations. Expand only
              when you need custom wording.
            </p>
            <SlideOverrideAccordion
              slides={editableSlides}
              overrides={data.slideOverrides ?? {}}
              onOverride={setSlideOverride}
            />
          </CollapsibleSection>
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-widest text-[#333]">
          {slides.length} slides · {data.status}
        </p>
      </div>

      {/* Error */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#1a1a1a] bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-[#0a0a0a]/95 px-4 pb-6 pt-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {error ? (
            <p className="text-center text-sm text-red-400">{error}</p>
          ) : null}
          {!error ? (
            <p
              aria-live="polite"
              className={`text-center text-[11px] ${
                isDirty ? "text-amber-300/80" : "text-emerald-300/70"
              }`}
            >
              {saving
                ? "Saving every detail\u2026"
                : isDirty
                  ? showRecoveredNotice
                    ? "Recovered unsaved details \u00b7 tap Save draft"
                    : "Unsaved changes \u00b7 tap Save draft"
                  : lastSavedAt
                    ? "All presentation details saved"
                    : "Draft ready to save"}
            </p>
          ) : null}
          <button
            type="button"
            onClick={present}
            disabled={!readyToPresent || presenting || saving}
            className="w-full rounded-xl bg-[#c9a96e] py-4 text-base font-medium tracking-wide text-black transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {presenting ? "Opening…" : "Start Presentation"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || presenting}
            className="w-full py-2 text-xs text-[#555] underline underline-offset-2 transition-colors hover:text-[#888] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          {!readyToPresent ? (
            <p className="text-center text-[10px] text-[#444]">
              Add client name and address to present
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
