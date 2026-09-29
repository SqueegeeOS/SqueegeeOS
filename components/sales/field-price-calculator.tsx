"use client";

import { useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { craftEyebrow, craftHeading, craftInput, craftLabel } from "@/lib/craft/tokens";
import {
  calculateFlexibleWindowPlan,
  calculateSolarFieldEstimate,
  SOLAR_RATE_PER_PANEL,
  VISITS_PER_YEAR,
  WINDOW_ADD_ONS,
  WINDOW_RATE_PER_SQFT,
  type RecurringCadence,
  type SolarCadence,
} from "@/lib/sales/field-estimate";

const RECURRING: Array<{ value: RecurringCadence; label: string }> = [
  { value: "quarterly", label: "4× / year" },
  { value: "triannual", label: "3× / year" },
  { value: "biannual", label: "2× / year" },
];
const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function numberFromField(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function choiceClass(active: boolean): string {
  return `min-h-11 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    active
      ? "border-accent/70 bg-accent/15 text-foreground"
      : "border-white/10 bg-white/[0.03] text-muted hover:border-accent/35 hover:text-foreground"
  }`;
}

export function FieldPriceCalculator() {
  const [service, setService] = useState<"windows" | "solar">("windows");
  const [windowCadence, setWindowCadence] = useState<RecurringCadence>("quarterly");
  const [squareFeet, setSquareFeet] = useState("");
  const [screenVisits, setScreenVisits] = useState(1);
  const [interiorVisits, setInteriorVisits] = useState(1);
  const [twoStory, setTwoStory] = useState(false);
  const [adjustWindow, setAdjustWindow] = useState(false);
  const [screenPrice, setScreenPrice] = useState(String(WINDOW_ADD_ONS.screens));
  const [interiorPrice, setInteriorPrice] = useState(String(WINDOW_ADD_ONS.interior));
  const [storyPrice, setStoryPrice] = useState(String(WINDOW_ADD_ONS.twoStory));
  const [includeSolar, setIncludeSolar] = useState(false);
  const [solarCadence, setSolarCadence] = useState<SolarCadence>("quarterly");
  const [panels, setPanels] = useState("");
  const [adjustSolar, setAdjustSolar] = useState(false);
  const [panelRate, setPanelRate] = useState(String(SOLAR_RATE_PER_PANEL.quarterly));

  const exteriorVisits = VISITS_PER_YEAR[windowCadence];
  const changeWindowCadence = (next: RecurringCadence) => {
    setWindowCadence(next);
    setScreenVisits((current) => Math.min(current, VISITS_PER_YEAR[next]));
    setInteriorVisits((current) => Math.min(current, VISITS_PER_YEAR[next]));
  };
  const changeSolarCadence = (next: SolarCadence) => {
    setSolarCadence(next);
    if (!adjustSolar) setPanelRate(String(SOLAR_RATE_PER_PANEL[next]));
  };
  const resetWindowPrices = () => {
    setScreenPrice(String(WINDOW_ADD_ONS.screens));
    setInteriorPrice(String(WINDOW_ADD_ONS.interior));
    setStoryPrice(String(WINDOW_ADD_ONS.twoStory));
    setAdjustWindow(false);
  };

  const windowPlan = service === "windows"
    ? calculateFlexibleWindowPlan({
        squareFeet: numberFromField(squareFeet),
        cadence: windowCadence,
        screenVisitsPerYear: screenVisits,
        interiorVisitsPerYear: interiorVisits,
        twoStory,
        screenPrice: adjustWindow ? numberFromField(screenPrice) : undefined,
        interiorPrice: adjustWindow ? numberFromField(interiorPrice) : undefined,
        twoStoryPrice: adjustWindow ? numberFromField(storyPrice) : undefined,
      })
    : null;
  const solarEstimate = service === "solar" || includeSolar
    ? calculateSolarFieldEstimate({
        panels: numberFromField(panels),
        cadence: solarCadence,
        panelRate: adjustSolar ? numberFromField(panelRate) : undefined,
      })
    : null;
  const complete = service === "windows"
    ? Boolean(windowPlan && (!includeSolar || solarEstimate))
    : Boolean(solarEstimate);
  const annualPlanCents = (windowPlan?.annualCents ?? 0) + (solarEstimate?.annualCents ?? 0);

  return (
    <section id="field-pricing" className="mt-7 scroll-mt-24" aria-labelledby="field-pricing-title">
      <GlassCard tone="elevated" padding="lg" rim>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={craftEyebrow}>David&apos;s field guide</p>
            <h2 id="field-pricing-title" className={`mt-2 text-3xl ${craftHeading}`}>
              Build the right care rhythm.
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-muted">
            Working estimate only. Nothing here is saved or sent to a customer.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2" aria-label="Choose a starting service">
          <button type="button" aria-pressed={service === "windows"} onClick={() => setService("windows")} className={choiceClass(service === "windows")}>Window plan</button>
          <button type="button" aria-pressed={service === "solar"} onClick={() => setService("solar")} className={choiceClass(service === "solar")}>Solar only</button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div>
            {service === "windows" ? (
              <>
                <p className={craftLabel}>Exterior window visits</p>
                <div className="grid grid-cols-3 gap-2">
                  {RECURRING.map((option) => (
                    <button key={option.value} type="button" aria-pressed={windowCadence === option.value} onClick={() => changeWindowCadence(option.value)} className={choiceClass(windowCadence === option.value)}>{option.label}</button>
                  ))}
                </div>
                <label htmlFor="field-window-sqft" className={`mt-6 ${craftLabel}`}>Home square footage</label>
                <input id="field-window-sqft" type="number" inputMode="numeric" min="1" max="100000" step="1" placeholder="e.g. 2000" value={squareFeet} onChange={(event) => setSquareFeet(event.target.value)} className={craftInput} />
                <p className="mt-2 text-xs text-muted">Exterior base: {MONEY.format(WINDOW_RATE_PER_SQFT[windowCadence])} per sq ft on each window visit.</p>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setScreenVisits(1); setInteriorVisits(1); }} className={choiceClass(screenVisits === 1 && interiorVisits === 1)}>Annual complete + maintenance</button>
                  <button type="button" onClick={() => { setScreenVisits(exteriorVisits); setInteriorVisits(1); }} className={choiceClass(screenVisits === exteriorVisits && interiorVisits === 1)}>Screens every visit</button>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted">Or set each service frequency independently:</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="field-screen-visits" className={craftLabel}>Screen-cleaning visits / year</label>
                    <select id="field-screen-visits" value={screenVisits} onChange={(event) => setScreenVisits(Number(event.target.value))} className={craftInput}>
                      {Array.from({ length: exteriorVisits + 1 }, (_, count) => <option key={count} value={count}>{count === 0 ? "Not included" : `${count} of ${exteriorVisits} visits`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="field-interior-visits" className={craftLabel}>Interior-cleaning visits / year</label>
                    <select id="field-interior-visits" value={interiorVisits} onChange={(event) => setInteriorVisits(Number(event.target.value))} className={craftInput}>
                      {Array.from({ length: exteriorVisits + 1 }, (_, count) => <option key={count} value={count}>{count === 0 ? "Not included" : `${count} of ${exteriorVisits} visits`}</option>)}
                    </select>
                  </div>
                </div>
                <button type="button" aria-pressed={twoStory} onClick={() => setTwoStory(!twoStory)} className={`mt-4 flex w-full items-center justify-between gap-3 text-left ${choiceClass(twoStory)}`}>
                  <span>Two-story home</span><span>+{MONEY.format(adjustWindow ? numberFromField(storyPrice) || 0 : WINDOW_ADD_ONS.twoStory)} / window visit</span>
                </button>
                <button type="button" onClick={() => adjustWindow ? resetWindowPrices() : setAdjustWindow(true)} className="mt-3 min-h-11 text-xs font-semibold text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {adjustWindow ? "Use standard add-on prices" : "Adjust add-on prices"}
                </button>
                {adjustWindow ? (
                  <div className="grid gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-4 sm:grid-cols-3">
                    {([
                      ["Screens · $/visit", screenPrice, setScreenPrice, "field-screen-price"],
                      ["Interior · $/visit", interiorPrice, setInteriorPrice, "field-interior-price"],
                      ["Two-story · $/visit", storyPrice, setStoryPrice, "field-story-price"],
                    ] as const).map(([label, value, setter, id]) => (
                      <div key={id}><label htmlFor={id} className={craftLabel}>{label}</label><input id={id} type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={value} onChange={(event) => setter(event.target.value)} className={craftInput} /></div>
                    ))}
                  </div>
                ) : null}
                <button type="button" aria-pressed={includeSolar} onClick={() => setIncludeSolar(!includeSolar)} className={`mt-5 flex w-full items-center justify-between gap-3 text-left ${choiceClass(includeSolar)}`}>
                  <span>Add recurring solar panels</span><span>Separate rhythm</span>
                </button>
              </>
            ) : null}

            {service === "solar" || includeSolar ? (
              <div className={service === "windows" ? "mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.05] p-4" : ""}>
                <p className={craftLabel}>Solar panel visits</p>
                <div className="grid grid-cols-3 gap-2">
                  {RECURRING.map((option) => (
                    <button key={option.value} type="button" aria-pressed={solarCadence === option.value} onClick={() => changeSolarCadence(option.value)} className={choiceClass(solarCadence === option.value)}>{option.label}</button>
                  ))}
                </div>
                <button type="button" aria-pressed={solarCadence === "one_time"} onClick={() => changeSolarCadence("one_time")} className={`mt-2 w-full ${choiceClass(solarCadence === "one_time")}`}>One-time solar · $11/panel</button>
                <label htmlFor="field-solar-panels" className={`mt-5 ${craftLabel}`}>Number of panels</label>
                <input id="field-solar-panels" type="number" inputMode="numeric" min="1" max="100000" step="1" placeholder="e.g. 20" value={panels} onChange={(event) => setPanels(event.target.value)} className={craftInput} />
                <p className="mt-2 text-xs text-muted">Standard: {MONEY.format(SOLAR_RATE_PER_PANEL[solarCadence])} per panel on each solar visit.</p>
                <button type="button" onClick={() => { setAdjustSolar(!adjustSolar); setPanelRate(String(SOLAR_RATE_PER_PANEL[solarCadence])); }} className="mt-3 min-h-11 text-xs font-semibold text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {adjustSolar ? "Use standard panel rate" : "Adjust panel rate"}
                </button>
                {adjustSolar ? <div className="max-w-xs rounded-2xl border border-accent/25 bg-accent/[0.05] p-4"><label htmlFor="field-panel-rate" className={craftLabel}>Price per panel · $</label><input id="field-panel-rate" type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={panelRate} onChange={(event) => setPanelRate(event.target.value)} className={craftInput} /></div> : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col rounded-[1.4rem] border border-accent/25 bg-black/20 p-5 sm:p-6" aria-live="polite">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Field estimate</p>
            {complete ? (
              <>
                {windowPlan ? (
                  <>
                    <p className="mt-3 font-serif text-5xl tabular-nums text-foreground">{MONEY.format(annualPlanCents / 100)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">recurring annual service value</p>
                    <p className="mt-5 text-sm leading-6 text-foreground/80">Exterior base: <strong className="text-foreground">{MONEY.format(windowPlan.exteriorVisitCents / 100)}</strong> per window visit.</p>
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      {windowPlan.lines.map((line) => (
                        <div key={line.label} className="flex justify-between gap-3 text-sm text-foreground/75"><span>{line.visits} × {line.label} @ {MONEY.format(line.unitCents / 100)}</span><span className="tabular-nums text-foreground">{MONEY.format(line.annualCents / 100)}</span></div>
                      ))}
                      {includeSolar && solarEstimate?.annualCents !== null && solarEstimate ? <div className="flex justify-between gap-3 text-sm text-foreground/75"><span>{solarEstimate.visitsPerYear} × solar @ {MONEY.format(solarEstimate.visitTotalCents / 100)}</span><span className="tabular-nums text-foreground">{MONEY.format(solarEstimate.annualCents / 100)}</span></div> : null}
                    </div>
                    <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-muted">If the first visit groups all selected window services, it is {MONEY.format(windowPlan.fullestVisitCents / 100)}. The other visit prices depend on which services occur that day.</p>
                    {includeSolar && solarEstimate?.annualCents === null ? <p className="mt-2 text-xs leading-5 text-amber-100">One-time solar adds {MONEY.format(solarEstimate.visitTotalCents / 100)} once; it is not included in recurring annual value.</p> : null}
                  </>
                ) : solarEstimate ? (
                  <>
                    <p className="mt-3 font-serif text-5xl tabular-nums text-foreground">{MONEY.format(solarEstimate.visitTotalCents / 100)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">per solar visit</p>
                    <p className="mt-6 border-t border-white/10 pt-5 text-sm text-foreground/80">{solarEstimate.annualCents === null ? "One-time service; no recurring value implied." : `${solarEstimate.visitsPerYear} visits/year · ${MONEY.format(solarEstimate.annualCents / 100)} annual service value`}</p>
                  </>
                ) : null}
              </>
            ) : (
              <p className="mt-5 text-sm leading-6 text-muted">Enter a valid {service === "windows" ? includeSolar ? "home size and solar panel count" : "home size" : "solar panel count"} to see the estimate.</p>
            )}
            <p className="mt-auto pt-6 text-xs leading-5 text-muted">The customer-facing presentation must spell out which services happen on which visits. Confirm final scope, price, and schedule before sending. Difficult access or unusual buildup needs owner review.</p>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
