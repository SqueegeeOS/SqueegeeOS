"use client";

import { useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { formatTierPrice } from "@/lib/membership/tier-config";
import {
  applyCarePlanServicePolicy,
  applyCarePlanPreset,
  createDefaultCarePlan,
  deriveCarePlanServicePolicy,
  PRESENTATION_LAYOUT_OPTIONS,
  summarizeCarePlan,
  type CarePlanPresetId,
  type CarePlanPricedServiceId,
  type CarePlanServiceId,
  type CarePlanServicePolicy,
  type CarePlanServiceState,
  type CarePlanVisit,
  type PresentationCarePlan,
  type PresentationLayout,
} from "@/lib/presentations/care-plan";
import { computePresentationRates } from "@/lib/presentations/calculations";
import type { PresentationData } from "@/lib/presentations/types";

interface PresentationPlanStudioProps {
  presentation: PresentationData;
  onChange: (patch: Partial<PresentationData>) => void;
}

const PLAN_PRESETS: Array<{
  id: CarePlanPresetId;
  label: string;
  description: string;
}> = [
  {
    id: "exterior_only",
    label: "Exterior only",
    description: "No interior or screens included.",
  },
  {
    id: "screens_every_visit",
    label: "Screens always",
    description: "Exterior + screens every visit.",
  },
  {
    id: "annual_interior",
    label: "Annual interior",
    description: "Exterior every visit, interior once yearly.",
  },
  {
    id: "flexible_add_ons",
    label: "Ask each visit",
    description: "Every extra service stays optional until confirmed.",
  },
  {
    id: "full_service",
    label: "Whole-home care",
    description: "Interior, screens, and cobwebbing every visit.",
  },
  {
    id: "solar_window_rotation",
    label: "Solar + glass rotation",
    description: "Solar, solar + exterior, solar, then exterior.",
  },
];

const ASSISTANT_EXAMPLES = [
  "Quarterly exterior. Interior once a year. Screens only if they ask.",
  "Mandi wants exterior and screens every visit, with interior on the first visit each year.",
  "Bi-annual exterior. Ask about screens, interior, and cobwebbing before each visit.",
  "Quarterly: solar panels first, exterior windows plus panels second, panels third, exterior windows fourth. Interior is optional for $150.",
];

const SERVICE_POLICY_OPTIONS: Array<{
  id: CarePlanServicePolicy;
  label: string;
}> = [
  { id: "always_included", label: "Every visit" },
  { id: "selected_visits", label: "Choose visits" },
  { id: "optional_add_on", label: "Ask customer" },
  { id: "not_offered", label: "Not offered" },
];

const CARE_PLAN_SERVICES: Array<{
  id: CarePlanServiceId;
  priceId: CarePlanPricedServiceId | null;
  label: string;
  description: string;
}> = [
  {
    id: "exteriorWindows",
    priceId: null,
    label: "Exterior windows",
    description: "Uses the base visit price and can now vary by visit.",
  },
  {
    id: "screens",
    priceId: "screens",
    label: "Screen cleaning",
    description: "Standard presentation add-on is $50 when included.",
  },
  {
    id: "interiorWindows",
    priceId: "interiorWindows",
    label: "Interior windows",
    description: "Standard presentation add-on is $100 when included.",
  },
  {
    id: "cobwebRemoval",
    priceId: "cobwebRemoval",
    label: "Cobweb removal",
    description: "Editable field price; never part of the website estimate.",
  },
  {
    id: "solarPanels",
    priceId: "solarPanels",
    label: "Solar panels",
    description: "Property-specific. Quote it here or set the exact visit total.",
  },
  {
    id: "pressureWashing",
    priceId: "pressureWashing",
    label: "Pressure washing",
    description: "Property-specific. Never added to a website estimate automatically.",
  },
];

const VISIT_SERVICE_CONTROLS: Array<{
  id: CarePlanServiceId;
  label: string;
}> = [
  { id: "exteriorWindows", label: "Exterior windows" },
  { id: "solarPanels", label: "Solar panels" },
  { id: "interiorWindows", label: "Interior windows" },
  { id: "screens", label: "Screens" },
  { id: "cobwebRemoval", label: "Cobweb removal" },
  { id: "pressureWashing", label: "Pressure washing" },
];

type AssistantResponse = {
  tier: PresentationData["tier"];
  layout: PresentationLayout;
  carePlan: PresentationCarePlan;
  closingNote: string;
  explanation: string;
  error?: string;
};

function ServiceStateControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CarePlanServiceState;
  onChange: (value: CarePlanServiceState) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as CarePlanServiceState)
        }
        className="min-h-11 w-full rounded-xl border border-white/10 bg-[#121212] px-3 text-sm text-white outline-none transition focus:border-[#c9a96e]/60"
      >
        <option value="included">Included</option>
        <option value="optional">Optional add-on</option>
        <option value="not_included">Not included</option>
      </select>
    </label>
  );
}

function VisitEditor({
  visit,
  price,
  onChange,
}: {
  visit: CarePlanVisit;
  price: number | null;
  onChange: (visit: CarePlanVisit) => void;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.025)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={visit.label}
            onChange={(event) => onChange({ ...visit, label: event.target.value })}
            aria-label="Visit name"
            className="w-full bg-transparent font-serif text-lg text-white outline-none placeholder:text-white/25"
            placeholder="Visit name"
          />
          <input
            value={visit.timing}
            onChange={(event) => onChange({ ...visit, timing: event.target.value })}
            aria-label="Visit timing"
            className="mt-1 w-full bg-transparent text-xs text-white/50 outline-none placeholder:text-white/20"
            placeholder="When this visit happens"
          />
        </div>
        {price != null ? (
          <div className="shrink-0 text-right">
            <p className="font-serif text-lg text-[#d8c28f]">
              {formatTierPrice(price)}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-white/30">
              estimated
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
            Scope
          </p>
          <p className="mt-1 truncate text-sm text-white/65">
            {[
              visit.exteriorWindows,
              visit.interiorWindows,
              visit.screens,
              visit.cobwebRemoval,
              visit.solarPanels,
              visit.pressureWashing,
            ].filter((state) => state === "included").length} service
            {[
              visit.exteriorWindows,
              visit.interiorWindows,
              visit.screens,
              visit.cobwebRemoval,
              visit.solarPanels,
              visit.pressureWashing,
            ].filter((state) => state === "included").length === 1
              ? ""
              : "s"}{" "}
            included this visit
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {VISIT_SERVICE_CONTROLS.map((service) => (
          <ServiceStateControl
            key={service.id}
            label={service.label}
            value={visit[service.id]}
            onChange={(state) =>
              onChange({ ...visit, [service.id]: state })
            }
          />
        ))}
      </div>

      <details className="mt-4 border-t border-white/[0.07] pt-3">
        <summary className="cursor-pointer text-xs text-white/45">
          Visit note or exact price
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
          <input
            value={visit.notes}
            onChange={(event) => onChange({ ...visit, notes: event.target.value })}
            className="min-h-11 rounded-xl border border-white/10 bg-[#121212] px-3 text-sm text-white outline-none focus:border-[#c9a96e]/60"
            placeholder="Special instructions for this visit"
          />
          <input
            type="number"
            inputMode="decimal"
            value={visit.priceOverride ?? ""}
            onChange={(event) => {
              const value = Number.parseFloat(event.target.value);
              onChange({
                ...visit,
                priceOverride: Number.isFinite(value) && value > 0 ? value : null,
              });
            }}
            className="min-h-11 rounded-xl border border-white/10 bg-[#121212] px-3 text-sm text-white outline-none focus:border-[#c9a96e]/60"
            placeholder="Exact $ total"
            aria-label="Exact visit price override"
          />
        </div>
      </details>
    </article>
  );
}

export function PresentationPlanStudio({
  presentation,
  onChange,
}: PresentationPlanStudioProps) {
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantExplanation, setAssistantExplanation] = useState<string | null>(
    null,
  );
  const rates = useMemo(
    () => computePresentationRates(presentation),
    [presentation],
  );

  const useSimpleMode = () => {
    onChange({
      planMode: "simple",
      carePlan: createDefaultCarePlan({
        tier: presentation.tier,
        includeInterior: presentation.includeInterior,
        includeScreens: presentation.includeScreens,
      }),
    });
  };

  const useCustomMode = () => {
    onChange({
      planMode: "custom",
      carePlan:
        presentation.carePlan?.tier === presentation.tier
          ? presentation.carePlan
          : createDefaultCarePlan({
              tier: presentation.tier,
              includeInterior: presentation.includeInterior,
              includeScreens: presentation.includeScreens,
            }),
    });
  };

  const setPlan = (carePlan: PresentationCarePlan) => {
    onChange({ planMode: "custom", carePlan });
  };

  const setServicePolicy = (
    serviceId: CarePlanServiceId,
    policy: CarePlanServicePolicy,
  ) => {
    setPlan(
      applyCarePlanServicePolicy(presentation.carePlan, serviceId, policy),
    );
  };

  const setServicePrice = (
    serviceId: CarePlanPricedServiceId,
    value: number,
  ) => {
    setPlan({
      ...presentation.carePlan,
      servicePrices: {
        ...presentation.carePlan.servicePrices,
        [serviceId]: Number.isFinite(value) && value >= 0 ? value : 0,
      },
    });
  };

  const updateVisit = (index: number, visit: CarePlanVisit) => {
    const visits = presentation.carePlan.visits.map((existing, visitIndex) =>
      visitIndex === index ? visit : existing,
    );
    setPlan({ ...presentation.carePlan, visits });
  };

  const runAssistant = async () => {
    if (brief.trim().length < 8 || generating) return;
    setGenerating(true);
    setAssistantError(null);
    setAssistantExplanation(null);
    try {
      const response = await fetch("/api/presentations/plan-assistant", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          presentationId: presentation.id,
          brief: brief.trim(),
          currentTier: presentation.tier,
          customerName: presentation.clientName,
          homeSqft: presentation.homeSqft,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | AssistantResponse
        | null;
      if (!response.ok || !body?.carePlan) {
        throw new Error(body?.error ?? "Atlas could not build that plan.");
      }
      onChange({
        tier: body.tier,
        planMode: "custom",
        presentationLayout: body.layout,
        carePlan: body.carePlan,
        customNotes: body.closingNote || presentation.customNotes,
      });
      setAssistantExplanation(body.explanation);
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : "Atlas could not build that plan.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-[#c9a96e]/20 bg-[radial-gradient(circle_at_top_right,rgba(201,169,110,0.12),transparent_38%),#0d0d0d] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/[0.08] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#c9a96e]">
              Atlas Plan Studio
            </p>
            <h2 className="mt-2 font-serif text-2xl text-white">
              Describe it once. Present it perfectly.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Keep routine plans fast, or build the exact scope for every visit.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/50">
            {summarizeCarePlan(presentation.carePlan)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-black/25 p-1.5">
          <button
            type="button"
            onClick={useSimpleMode}
            className={`min-h-12 rounded-xl px-4 text-sm font-medium transition ${
              presentation.planMode === "simple"
                ? "bg-white text-black shadow-lg"
                : "text-white/55 hover:text-white"
            }`}
          >
            Simple plan
          </button>
          <button
            type="button"
            onClick={useCustomMode}
            className={`min-h-12 rounded-xl px-4 text-sm font-medium transition ${
              presentation.planMode === "custom"
                ? "bg-[#c9a96e] text-black shadow-lg"
                : "text-white/55 hover:text-white"
            }`}
          >
            Custom rhythm
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.035] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-300/15 text-sm text-violet-100">
              ✦
            </span>
            <div>
              <p className="text-sm font-medium text-violet-100">Ask Atlas</p>
              <p className="text-[11px] text-violet-100/45">
                Plain English → editable service plan
              </p>
            </div>
          </div>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={4}
            placeholder="Mandi wants exterior windows and screens every visit, with interior once a year…"
            className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-violet-300/45"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {ASSISTANT_EXAMPLES.map((example, index) => (
              <button
                key={example}
                type="button"
                onClick={() => setBrief(example)}
                className="rounded-full border border-white/[0.09] px-3 py-1.5 text-[10px] text-white/45 transition hover:border-violet-300/30 hover:text-violet-100"
              >
                Example {index + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={runAssistant}
            disabled={brief.trim().length < 8 || generating}
            className="mt-4 min-h-12 w-full rounded-xl bg-gradient-to-r from-violet-300 via-[#d5b8ff] to-[#c9a96e] px-4 text-sm font-semibold text-[#090909] shadow-[0_12px_30px_rgba(167,139,250,0.15)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {generating ? "Atlas is architecting the plan…" : "Build plan with Atlas"}
          </button>
          <p className="mt-2 text-center text-[10px] text-white/30">
            Review before saving · never enter payment details here
          </p>
          {assistantError ? (
            <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.05] p-3 text-xs text-red-200/80">
              {assistantError}
            </p>
          ) : null}
          {assistantExplanation ? (
            <p className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-xs leading-relaxed text-emerald-100/75">
              <span className="font-semibold text-emerald-100">Atlas understood:</span>{" "}
              {assistantExplanation}
            </p>
          ) : null}
        </div>

        {presentation.planMode === "simple" ? (
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-sm font-medium text-white">Fast field setup</p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Use the home-size section below to include screens or interior on
              every visit. This keeps the close fast and the pricing uniform.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Quick patterns
                </p>
                <p className="mt-1 text-sm text-white/60">
                  Start here, then tune any visit.
                </p>
              </div>
              {rates.carePlanPricing ? (
                <div className="text-right">
                  <p className="font-serif text-2xl text-[#d8c28f]">
                    {formatTierPrice(rates.carePlanPricing.annualTotal)}/yr
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">
                    estimated plan total
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PLAN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setPlan(applyCarePlanPreset(presentation.carePlan, preset.id))
                  }
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition hover:border-[#c9a96e]/35 hover:bg-[#c9a96e]/[0.04]"
                >
                  <span className="block text-sm font-medium text-white/80">
                    {preset.label}
                  </span>
                  <span className="mt-1 block text-[11px] text-white/40">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#c9a96e]/20 bg-[#c9a96e]/[0.035] p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a96e]">
                    Service rules
                  </p>
                  <h3 className="mt-1 font-serif text-xl text-white">
                    Decide once, then fine-tune the visits.
                  </h3>
                </div>
                <p className="max-w-sm text-xs leading-relaxed text-white/45 sm:text-right">
                  Website pricing starts with exterior glass only. These amounts
                  apply only when a service is deliberately included.
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {CARE_PLAN_SERVICES.map((service) => {
                  const policy = deriveCarePlanServicePolicy(
                    presentation.carePlan,
                    service.id,
                  );
                  return (
                    <article
                      key={service.id}
                      className="rounded-2xl border border-white/[0.09] bg-black/20 p-4"
                    >
                      <p className="text-sm font-medium text-white">
                        {service.label}
                      </p>
                      <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-white/40">
                        {service.description}
                      </p>
                      <label className="mt-4 block">
                        <span className="mb-1.5 block text-[9px] uppercase tracking-[0.14em] text-white/40">
                          Customer plan
                        </span>
                        <select
                          value={policy}
                          onChange={(event) =>
                            setServicePolicy(
                              service.id,
                              event.target.value as CarePlanServicePolicy,
                            )
                          }
                          className="min-h-11 w-full rounded-xl border border-white/10 bg-[#121212] px-3 text-sm text-white outline-none focus:border-[#c9a96e]/60"
                        >
                          {SERVICE_POLICY_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {service.priceId ? <label className="mt-3 block">
                        <span className="mb-1.5 block text-[9px] uppercase tracking-[0.14em] text-white/40">
                          Price when included
                        </span>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/35">
                            $
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="1"
                            value={presentation.carePlan.servicePrices[service.priceId]}
                            onChange={(event) =>
                              setServicePrice(
                                service.priceId!,
                                Number.parseFloat(event.target.value),
                              )
                            }
                            aria-label={`${service.label} included price`}
                            className="min-h-11 w-full rounded-xl border border-white/10 bg-[#121212] pl-7 pr-3 text-sm text-white outline-none focus:border-[#c9a96e]/60"
                          />
                        </div>
                      </label> : (
                        <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-[10px] leading-relaxed text-white/45">
                          Included visits use the presentation&apos;s exterior base rate.
                        </p>
                      )}
                      {policy === "selected_visits" ? (
                        <p className="mt-2 text-[10px] leading-relaxed text-[#d8c28f]/70">
                          Choose Included, Optional, or Not included on each visit below.
                        </p>
                      ) : policy === "optional_add_on" ? (
                        <p className="mt-2 text-[10px] leading-relaxed text-emerald-100/60">
                          The plan shows this as customer choice and adds $0 until selected.
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {presentation.carePlan.visits.map((visit, index) => (
                <VisitEditor
                  key={visit.id}
                  visit={visit}
                  price={rates.carePlanPricing?.visits[index]?.total ?? null}
                  onChange={(next) => updateVisit(index, next)}
                />
              ))}
            </div>

            <div className="mt-4 grid gap-3">
              <label>
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  Customer-facing plan summary
                </span>
                <textarea
                  value={presentation.carePlan.summary}
                  onChange={(event) =>
                    setPlan({
                      ...presentation.carePlan,
                      summary: event.target.value,
                    })
                  }
                  rows={2}
                  className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9a96e]/60"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  Optional-service promise
                </span>
                <textarea
                  value={presentation.carePlan.customerChoiceNote}
                  onChange={(event) =>
                    setPlan({
                      ...presentation.carePlan,
                      customerChoiceNote: event.target.value,
                    })
                  }
                  rows={2}
                  className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9a96e]/60"
                />
              </label>
            </div>
          </div>
        )}

        <div className="mt-7 border-t border-white/[0.08] pt-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            Presentation style
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {PRESENTATION_LAYOUT_OPTIONS.map((layout) => (
              <button
                key={layout.id}
                type="button"
                onClick={() => onChange({ presentationLayout: layout.id })}
                className={`rounded-2xl border p-4 text-left transition ${
                  presentation.presentationLayout === layout.id
                    ? "border-[#c9a96e]/55 bg-[#c9a96e]/[0.08]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className="block text-sm font-medium text-white">
                  {layout.label}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-wider text-[#c9a96e]/65">
                  {layout.slideCount}
                </span>
                <span className="mt-2 block text-[11px] leading-relaxed text-white/40">
                  {layout.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
