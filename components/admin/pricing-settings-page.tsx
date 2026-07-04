"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { useCompanySettings } from "@/components/pricing/pricing-settings-provider";
import { isAdminUnlocked } from "@/lib/admin/pin";
import {
  normalizeCompanySettings,
  perThousandFromRate,
  settingsFromPerThousandSqft,
  validateCompanySettings,
  type CompanySettings,
} from "@/lib/pricing/company-settings";
import { formatDollars } from "@/lib/pricing/format";
import { ROUTES } from "@/lib/navigation/config";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus:border-accent/40";

const labelClass = "text-[10px] uppercase tracking-[0.24em] text-muted";

export function PricingSettingsPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  const { settings, loading, storage, saveSettings, refresh } = useCompanySettings();
  const [draft, setDraft] = useState<CompanySettings>(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  const updateDraft = (patch: Partial<CompanySettings>) => {
    setDraft((prev) => normalizeCompanySettings({ ...prev, ...patch }));
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    const normalized = normalizeCompanySettings(draft);
    const validationError = validateCompanySettings(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await saveSettings(normalized);
    setSaving(false);

    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Pricing law updated — builder, plans, and quotes use these numbers now.");
    }
    await refresh();
  };

  const handleReset = () => {
    setDraft(settings);
    setMessage(null);
    setError(null);
  };

  return (
    <div className="min-h-[100svh] bg-background pb-24">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={ROUTES.hqCarePlanBuilder}
          className="text-[10px] uppercase tracking-[0.22em] text-muted transition-colors hover:text-accent"
        >
          ← Home Care Plan Builder
        </Link>

        <header className="mt-8 border-b border-border/70 pb-10">
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted">
            Atlas Pricing Engine · Company law
          </p>
          <h1 className="mt-3 font-serif text-4xl font-light text-foreground">
            Pricing Settings
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Edit once — every surface that runs through the Atlas Pricing Engine
            updates: Care Plan Builder, Apply Standard Pricing, and quote math.
          </p>
          <p className="mt-2 text-xs text-muted/70">
            Storage: {loading ? "Loading…" : storage}
            {storage === "local" || storage === "cache"
              ? " · Connect Supabase and run migration 008 for team-wide sync"
              : ""}
          </p>
        </header>

        <form
          className="mt-10 space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <section className="rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 space-y-4">
            <p className={labelClass}>Property size limits</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Minimum sq ft</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.minimumQuoteSqft}
                  onChange={(e) =>
                    updateDraft({ minimumQuoteSqft: Number(e.target.value) })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Maximum sq ft</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.maximumQuoteSqft}
                  onChange={(e) =>
                    updateDraft({ maximumQuoteSqft: Number(e.target.value) })
                  }
                />
              </label>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 space-y-4">
            <p className={labelClass}>Every 3 Months</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Rate per 1,000 sq ft ($)</span>
                <input
                  type="number"
                  step={5}
                  className={`${inputClass} mt-2`}
                  value={perThousandFromRate(draft.rates.quarterly.ratePerSqft)}
                  onChange={(e) =>
                    updateDraft({
                      rates: {
                        ...draft.rates,
                        quarterly: {
                          ...draft.rates.quarterly,
                          ratePerSqft: settingsFromPerThousandSqft(
                            Number(e.target.value),
                          ),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Visits per year</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={`${inputClass} mt-2`}
                  value={draft.rates.quarterly.annualVisits}
                  onChange={(e) =>
                    updateDraft({
                      rates: {
                        ...draft.rates,
                        quarterly: {
                          ...draft.rates.quarterly,
                          annualVisits: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 space-y-4">
            <p className={labelClass}>Every 6 Months</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Rate per 1,000 sq ft ($)</span>
                <input
                  type="number"
                  step={5}
                  className={`${inputClass} mt-2`}
                  value={perThousandFromRate(draft.rates.bi_annual.ratePerSqft)}
                  onChange={(e) =>
                    updateDraft({
                      rates: {
                        ...draft.rates,
                        bi_annual: {
                          ...draft.rates.bi_annual,
                          ratePerSqft: settingsFromPerThousandSqft(
                            Number(e.target.value),
                          ),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Visits per year</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={`${inputClass} mt-2`}
                  value={draft.rates.bi_annual.annualVisits}
                  onChange={(e) =>
                    updateDraft({
                      rates: {
                        ...draft.rates,
                        bi_annual: {
                          ...draft.rates.bi_annual,
                          annualVisits: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 space-y-4">
            <p className={labelClass}>Equations</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Interior + exterior multiplier</span>
                <input
                  type="number"
                  step={0.05}
                  min={1}
                  max={3}
                  className={`${inputClass} mt-2`}
                  value={draft.interiorMultiplier}
                  onChange={(e) =>
                    updateDraft({ interiorMultiplier: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-muted">
                  Interior + exterior = exterior × {draft.interiorMultiplier}
                </p>
              </label>
              <label className="block">
                <span className={labelClass}>One-time visit premium ($)</span>
                <input
                  type="number"
                  step={5}
                  min={0}
                  className={`${inputClass} mt-2`}
                  value={draft.oneTimePremium}
                  onChange={(e) =>
                    updateDraft({ oneTimePremium: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-muted">
                  One-time exterior = recurring exterior +{" "}
                  {formatDollars(draft.oneTimePremium)}
                </p>
              </label>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border/70 bg-surface/40 p-6 space-y-4">
            <p className={labelClass}>Exterior add-ons</p>
            <p className="text-xs text-muted">
              Soft wash is a flat quote for typical homes. Moss and concrete use
              treated area sq ft only.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelClass}>Soft wash — default price ($)</span>
                <input
                  type="number"
                  step={5}
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.softWash.defaultPrice}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        softWash: {
                          ...draft.exteriorAddOns.softWash,
                          defaultPrice: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Soft wash min ($)</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.softWash.minPrice}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        softWash: {
                          ...draft.exteriorAddOns.softWash,
                          minPrice: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Soft wash max ($)</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.softWash.maxPrice}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        softWash: {
                          ...draft.exteriorAddOns.softWash,
                          maxPrice: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Large home threshold (sq ft)</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.softWash.largeHomeSqftThreshold}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        softWash: {
                          ...draft.exteriorAddOns.softWash,
                          largeHomeSqftThreshold: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Large home +$/1,000 sq ft</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.softWash.largeHomePer1000Sqft}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        softWash: {
                          ...draft.exteriorAddOns.softWash,
                          largeHomePer1000Sqft: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Moss removal ($/sq ft)</span>
                <input
                  type="number"
                  step={0.05}
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.mossRemoval.ratePerSqft}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        mossRemoval: {
                          ratePerSqft: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Concrete pressure wash ($/sq ft)</span>
                <input
                  type="number"
                  step={0.05}
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.pressureWashConcrete.ratePerSqft}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        pressureWashConcrete: {
                          ratePerSqft: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
            <p className={`${labelClass} pt-2`}>Member add-on discount</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Quarterly (% off list)</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.memberAddOnDiscount.quarterly}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        memberAddOnDiscount: {
                          ...draft.exteriorAddOns.memberAddOnDiscount,
                          quarterly: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Bi-Annual (% off list)</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.memberAddOnDiscount.bi_annual}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        memberAddOnDiscount: {
                          ...draft.exteriorAddOns.memberAddOnDiscount,
                          bi_annual: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
            <p className={`${labelClass} pt-2`}>Screen rescreening (per screen)</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>1–2 screens ($)</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.screenRescreening.singleScreenPrice}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        screenRescreening: {
                          ...draft.exteriorAddOns.screenRescreening,
                          singleScreenPrice: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>3–5 screens ($ each)</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={
                    draft.exteriorAddOns.screenRescreening.midTierPricePerScreen
                  }
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        screenRescreening: {
                          ...draft.exteriorAddOns.screenRescreening,
                          midTierPricePerScreen: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>6+ screens ($ each)</span>
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={draft.exteriorAddOns.screenRescreening.bulkPricePerScreen}
                  onChange={(e) =>
                    updateDraft({
                      exteriorAddOns: {
                        ...draft.exteriorAddOns,
                        screenRescreening: {
                          ...draft.exteriorAddOns.screenRescreening,
                          bulkPricePerScreen: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>

          {error && <p className="text-sm text-red-400/90">{error}</p>}
          {message && <p className="text-sm text-accent/90">{message}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-2xl bg-accent px-6 py-3 text-sm font-medium text-background disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save pricing law"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-2xl border border-border px-6 py-3 text-sm text-muted"
            >
              Revert changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
