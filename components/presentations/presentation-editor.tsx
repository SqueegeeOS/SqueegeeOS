"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { buildExteriorWindowBreakdown } from "@/lib/pricing/window-care-pricing";
import {
  getPresentationSlides,
  tierLabel,
  type PresentationData,
  type SlideOverride,
  type SlideType,
} from "@/lib/presentations/types";
import { formatTierPrice } from "@/lib/membership/tier-config";
import {
  CollapsibleSection,
  EditorField,
  EditorTextArea,
  EditorTextInput,
  SlideOverrideAccordion,
  TierPicker,
} from "./presentation-editor-kit";

export function PresentationEditor({
  presentation: initial,
}: {
  presentation: PresentationData;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const twoStory = data.twoStory;
  const includeScreens = data.includeScreens;

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

  const setPricingOption = (
    patch: Partial<{ twoStory: boolean; includeScreens: boolean }>,
  ) => {
    setData((prev) =>
      recalculateVisitRate(prev, {
        twoStory: patch.twoStory ?? prev.twoStory,
        includeScreens: patch.includeScreens ?? prev.includeScreens,
      }),
    );
  };

  const exteriorBreakdown =
    data.homeSqft > 0
      ? buildExteriorWindowBreakdown(
          data.homeSqft,
          data.tier === "quarterly" ? "quarterly" : "bi_annual",
          { twoStory, includeScreens },
        )
      : null;

  const update = <K extends keyof PresentationData>(
    field: K,
    value: PresentationData[K],
  ) => {
    setData((prev) => {
      if (field === "tier") {
        const nextTier = value as PresentationData["tier"];
        return recalculateVisitRate(prev, {
          tier: nextTier,
          retailValue: nextTier === "biannual" ? 0 : prev.retailValue,
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
    update("slideOverrides", {
      ...data.slideOverrides,
      [slideId]: {
        ...data.slideOverrides?.[slideId as SlideType],
        [field]: value,
      },
    });
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/presentations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Could not save. Try again.");
        return false;
      }
      const json = (await res.json()) as { presentation: PresentationData };
      setData(json.presentation);
      cachePresentation(json.presentation);
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
      cachePresentation(data);
      const saved = await save();
      if (!saved) return;
      router.push(`/presentations/${data.id}/present`);
    } finally {
      setPresenting(false);
    }
  };

  const readyToPresent =
    data.clientName.trim().length > 0 && data.clientAddress.trim().length > 0;

  const pricingSummary =
    data.homeSqft > 0
      ? `${data.homeSqft.toLocaleString()} sq ft`
      : "Standard pricing";

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-36 text-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        <Link
          href="/presentations"
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
                  placeholder="Larry Buckley"
                  onChange={(v) => update("clientName", v)}
                />
              </EditorField>
              <EditorField label="Property address">
                <EditorTextInput
                  value={data.clientAddress}
                  placeholder="123 Canyon Oaks Dr, Chico"
                  onChange={(v) => update("clientAddress", v)}
                />
              </EditorField>
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
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-[#555]">
                Bi-Annual includes 20% off add-ons. RainBlock and Hard Water are
                not included — available as add-on services.
              </p>
            )}
          </section>

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
                  setData((prev) => recalculateVisitRate(prev, { homeSqft }));
                }}
              />
            </EditorField>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPricingOption({ twoStory: !twoStory })}
                className="rounded-lg border px-3 py-2 text-xs transition-colors"
                style={{
                  borderColor: twoStory ? "#c9a96e55" : "#222",
                  color: twoStory ? "#c9a96e" : "#555",
                  backgroundColor: twoStory ? "#141008" : "#111",
                }}
              >
                Two-story (+$100)
              </button>
              <button
                type="button"
                onClick={() =>
                  setPricingOption({ includeScreens: !includeScreens })
                }
                className="rounded-lg border px-3 py-2 text-xs transition-colors"
                style={{
                  borderColor: includeScreens ? "#c9a96e55" : "#222",
                  color: includeScreens ? "#c9a96e" : "#555",
                  backgroundColor: includeScreens ? "#141008" : "#111",
                }}
              >
                Screens (+$50)
              </button>
            </div>

            {exteriorBreakdown ? (
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
                <p className="mt-1.5 flex justify-between border-t border-[#1a1a1a] pt-1.5 text-[#888]">
                  <span>Per visit</span>
                  <span>${exteriorBreakdown.visitTotal}</span>
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
              label="Per-visit rate override"
              hint="Optional. Standard pricing applies when blank."
            >
              <EditorTextInput
                type="number"
                inputMode="decimal"
                value={tierOverride > 0 ? String(tierOverride) : ""}
                placeholder={String(
                  Math.round(
                    data.tier === "biannual"
                      ? rates.biannualVisit
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
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {error ? (
            <p className="text-center text-sm text-red-400">{error}</p>
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
