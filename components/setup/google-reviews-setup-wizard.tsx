"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { GoogleReviewsTestResult } from "@/lib/reviews/place-id-resolver";
import type { PlaceSearchCandidate } from "@/lib/reviews/place-id-resolver";
import {
  buildEnvLocalSnippet,
  buildVercelInstructions,
  DEFAULT_WIZARD_STATE,
  GOOGLE_CONSOLE_LINKS,
  loadWizardState,
  saveWizardState,
  WIZARD_STEPS,
  type GoogleReviewsWizardState,
  type WizardStepId,
} from "@/lib/reviews/google-reviews-wizard";
import { ROUTES } from "@/lib/navigation/config";

const inputClassName =
  "w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm text-foreground placeholder:text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
    >
      {children}
      <span aria-hidden className="text-muted">
        ↗
      </span>
    </a>
  );
}

function StepCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[1.75rem] border border-border/80 bg-surface/45 p-6 sm:p-8">
      <h2 className="font-serif text-2xl font-light text-foreground">{title}</h2>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </article>
  );
}

function CheckRow({
  passed,
  label,
  detail,
}: {
  passed: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <span className={passed ? "text-accent" : "text-muted"}>
        {passed ? "✅" : "○"}
      </span>
      <div>
        <p className="text-sm text-foreground">{label}</p>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      </div>
    </div>
  );
}

export function GoogleReviewsSetupWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<GoogleReviewsWizardState>(DEFAULT_WIZARD_STATE);
  const [searchResults, setSearchResults] = useState<PlaceSearchCandidate[]>([]);
  const [testing, setTesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [testResult, setTestResult] = useState<GoogleReviewsTestResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const step = WIZARD_STEPS[stepIndex];

  useEffect(() => {
    setState(loadWizardState());
  }, []);

  const persist = useCallback((next: GoogleReviewsWizardState) => {
    setState(next);
    saveWizardState(next);
  }, []);

  const update = useCallback(
    (patch: Partial<GoogleReviewsWizardState>) => {
      persist({ ...state, ...patch });
    },
    [persist, state],
  );

  const copyText = useCallback(async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!state.apiKey.trim()) {
      setStatusMessage("Enter your API key on step 4 first.");
      return;
    }
    setSearching(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/google-reviews/search", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          apiKey: state.apiKey,
          query: state.searchQuery,
        }),
      });
      if (!response.ok) throw new Error("Search failed");
      const json = (await response.json()) as { results: PlaceSearchCandidate[] };
      setSearchResults(json.results);
      if (json.results.length === 0) {
        setStatusMessage(
          "No results. Try your exact Google Business name + city, or paste your Maps link instead.",
        );
      }
    } catch {
      setStatusMessage("Search failed. Confirm your API key and that Places API is enabled.");
    } finally {
      setSearching(false);
    }
  }, [state.apiKey, state.searchQuery]);

  const handleResolveUrl = useCallback(async () => {
    if (!state.mapsUrl.trim()) return;
    setResolving(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/google-reviews/resolve-url", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({ url: state.mapsUrl }),
      });
      if (!response.ok) throw new Error("Could not resolve URL");
      const json = (await response.json()) as {
        placeId: string | null;
        resolvedUrl: string;
        found: boolean;
      };
      if (json.found && json.placeId) {
        update({
          placeId: json.placeId,
          testPassed: false,
        });
        setStatusMessage("Place ID found from your link.");
      } else {
        setStatusMessage(
          "Could not extract a Place ID from that link. Try search by business name, or copy the Place ID from Google's Place ID Finder.",
        );
      }
    } catch {
      setStatusMessage("Could not resolve that URL. Try pasting the full Google Maps page URL.");
    } finally {
      setResolving(false);
    }
  }, [state.mapsUrl, update]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setStatusMessage(null);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/google-reviews/test", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          apiKey: state.apiKey,
          placeId: state.placeId,
        }),
      });
      if (!response.ok) throw new Error("Test request failed");
      const json = (await response.json()) as GoogleReviewsTestResult;
      setTestResult(json);
      if (json.apiKeyValid && json.placeIdValid) {
        update({
          testPassed: json.reviewsFound,
          lastRating: json.rating,
          lastReviewCount: json.reviewCount,
          businessName: json.businessName ?? state.businessName,
        });
      } else {
        update({ testPassed: false });
      }
    } catch {
      setStatusMessage("Connection test failed. Check your PIN session and try again.");
    } finally {
      setTesting(false);
    }
  }, [state.apiKey, state.placeId, state.businessName, update]);

  const stepContent = useMemo(() => {
    switch (step.id as WizardStepId) {
      case "welcome":
        return (
          <StepCard title="Connect live Google Reviews">
            <p>
              This wizard walks you through Google Cloud setup — step by step.
              No guessing. When finished, SqueegeeKing will show your real
              Google rating and review count everywhere reviews appear.
            </p>
            <p className="text-foreground/90">
              You will need about 10 minutes and access to Google Cloud. Billing
              may need to be enabled on your Google Cloud project (Google offers
              free monthly credit for Maps Platform).
            </p>
          </StepCard>
        );
      case "project":
        return (
          <StepCard title="Create a Google Cloud project">
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                Open{" "}
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.createProject}>
                  Google Cloud Console → Create Project
                </ExternalLink>
              </li>
              <li>Name it something clear, e.g. <strong className="text-foreground">SqueegeeKing</strong></li>
              <li>Select that project in the top bar before continuing</li>
            </ol>
            <p>
              If you already have a project for SqueegeeKing, select it and
              continue.
            </p>
          </StepCard>
        );
      case "apis":
        return (
          <StepCard title="Enable the Places APIs">
            <p>Enable both APIs below while your SqueegeeKing project is selected:</p>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.placesApiNew}>
                  Places API (New)
                </ExternalLink>{" "}
                → Enable
              </li>
              <li>
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.placesApiLegacy}>
                  Places API
                </ExternalLink>{" "}
                → Enable
              </li>
            </ol>
            <p>
              If Google asks for billing, visit{" "}
              <ExternalLink href={GOOGLE_CONSOLE_LINKS.billing}>
                Billing
              </ExternalLink>{" "}
              and link a billing account. Reviews use very little quota.
            </p>
          </StepCard>
        );
      case "api-key":
        return (
          <StepCard title="Create your API key">
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                Open{" "}
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.credentials}>
                  APIs &amp; Services → Credentials
                </ExternalLink>
              </li>
              <li>Create credentials → <strong className="text-foreground">API key</strong></li>
              <li>Copy the key and paste it below</li>
            </ol>
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-muted">
                Google Maps API key
              </label>
              <input
                type="password"
                className={inputClassName}
                value={state.apiKey}
                onChange={(e) =>
                  update({ apiKey: e.target.value, testPassed: false })
                }
                placeholder="AIza..."
                autoComplete="off"
              />
              <p className="mt-2 text-xs">
                Stored only in this browser for the wizard. Never exposed to
                customers.
              </p>
            </div>
          </StepCard>
        );
      case "restrict":
        return (
          <StepCard title="Restrict your API key (important)">
            <ol className="list-decimal space-y-3 pl-5">
              <li>In Credentials, click your new API key</li>
              <li>
                Under <strong className="text-foreground">API restrictions</strong>, choose{" "}
                <em>Restrict key</em>
              </li>
              <li>Select only:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Places API (New)</li>
                  <li>Places API</li>
                </ul>
              </li>
              <li>Save</li>
            </ol>
            <p>
              We call Google from the server only — your key is never sent to
              website visitors.
            </p>
          </StepCard>
        );
      case "find":
        return (
          <StepCard title="Find your business on Google">
            <p className="text-foreground/90">Option A — Search by name</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className={inputClassName}
                value={state.searchQuery}
                onChange={(e) => update({ searchQuery: e.target.value })}
                placeholder="SqueegeeKing Chico, CA"
              />
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searching}
                className="shrink-0 rounded-full border border-accent/30 bg-accent/[0.1] px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-accent disabled:opacity-50"
              >
                {searching ? "Searching…" : "Search Google"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <button
                    key={result.placeId}
                    type="button"
                    onClick={() =>
                      update({
                        placeId: result.placeId,
                        businessName: result.name,
                        testPassed: false,
                      })
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      state.placeId === result.placeId
                        ? "border-accent/40 bg-accent/[0.08]"
                        : "border-border hover:border-accent/25"
                    }`}
                  >
                    <p className="text-sm text-foreground">{result.name}</p>
                    {result.address && (
                      <p className="mt-1 text-xs text-muted">{result.address}</p>
                    )}
                    {(result.rating ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-accent">
                        {result.rating} stars · {result.reviewCount} reviews
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <p className="pt-4 text-foreground/90">Option B — Paste Google Maps link</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className={inputClassName}
                value={state.mapsUrl}
                onChange={(e) => update({ mapsUrl: e.target.value })}
                placeholder="https://maps.google.com/... or https://g.page/..."
              />
              <button
                type="button"
                onClick={() => void handleResolveUrl()}
                disabled={resolving}
                className="shrink-0 rounded-full border border-border px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
              >
                {resolving ? "Resolving…" : "Find Place ID"}
              </button>
            </div>

            <p className="pt-4 text-foreground/90">Option C — Paste Place ID directly</p>
            <input
              className={inputClassName}
              value={state.placeId}
              onChange={(e) =>
                update({ placeId: e.target.value, testPassed: false })
              }
              placeholder="ChIJ..."
            />
            {state.placeId && (
              <p className="text-xs text-accent">
                Selected Place ID: {state.placeId}
                {state.businessName ? ` · ${state.businessName}` : ""}
              </p>
            )}
          </StepCard>
        );
      case "test":
        return (
          <StepCard title="Test your connection">
            <p>
              We will call Google with your API key and Place ID — the same way
              production does — and show your live rating before you deploy.
            </p>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !state.apiKey || !state.placeId}
              className="rounded-full border border-accent/30 bg-accent/[0.12] px-6 py-3.5 text-[10px] uppercase tracking-[0.2em] text-accent disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            {testResult && (
              <div className="space-y-3 pt-2">
                {testResult.checks.map((check) => (
                  <CheckRow
                    key={check.id}
                    passed={check.passed}
                    label={check.label}
                    detail={check.detail}
                  />
                ))}
                {testResult.rating !== null && testResult.reviewCount !== null && (
                  <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-accent">
                      Live on Google
                    </p>
                    <p className="mt-2 font-serif text-3xl font-light text-foreground">
                      {testResult.rating.toFixed(1)} stars ·{" "}
                      {testResult.reviewCount} reviews
                    </p>
                    {testResult.businessName && (
                      <p className="mt-2 text-sm text-muted">
                        {testResult.businessName}
                      </p>
                    )}
                  </div>
                )}
                {testResult.error && (
                  <p className="text-sm text-red-300/90">{testResult.error}</p>
                )}
              </div>
            )}
          </StepCard>
        );
      case "deploy":
        return (
          <StepCard title="Save and go live">
            <p>
              For <strong className="text-foreground">local testing</strong>,
              paste into <code className="text-accent">.env.local</code> and
              restart your dev server:
            </p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-background p-4 text-xs text-foreground">
              {buildEnvLocalSnippet(state.apiKey, state.placeId)}
            </pre>
            <button
              type="button"
              onClick={() =>
                void copyText(
                  "env",
                  buildEnvLocalSnippet(state.apiKey, state.placeId),
                )
              }
              className="rounded-full border border-border px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent"
            >
              {copied === "env" ? "Copied" : "Copy .env.local lines"}
            </button>

            <p className="pt-4">
              For <strong className="text-foreground">Vercel production</strong>,
              add these environment variables:
            </p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-background p-4 text-xs text-foreground whitespace-pre-wrap">
              {buildVercelInstructions(state.apiKey, state.placeId)}
            </pre>
            <button
              type="button"
              onClick={() =>
                void copyText(
                  "vercel",
                  buildVercelInstructions(state.apiKey, state.placeId),
                )
              }
              className="rounded-full border border-border px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent"
            >
              {copied === "vercel" ? "Copied" : "Copy Vercel instructions"}
            </button>

            <p className="pt-4 text-xs">
              After deploying, visit{" "}
              <Link href="/api/reviews/google" className="text-accent hover:underline">
                /api/reviews/google
              </Link>{" "}
              to confirm live data, or check any Home Care Plan reviews section.
            </p>
          </StepCard>
        );
      default:
        return null;
    }
  }, [
    copied,
    copyText,
    handleResolveUrl,
    handleSearch,
    handleTest,
    resolving,
    searchResults,
    searching,
    state,
    step.id,
    testResult,
    testing,
    update,
  ]);

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-background pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.08),transparent_55%)]" />
      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={ROUTES.hq}
          className="text-[10px] uppercase tracking-[0.22em] text-muted hover:text-accent"
        >
          ← Headquarters
        </Link>
        <p className="mt-8 text-[10px] uppercase tracking-[0.32em] text-accent">
          Setup Wizard
        </p>
        <h1 className="mt-4 font-serif text-4xl font-light text-foreground">
          Google Reviews
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Step {stepIndex + 1} of {WIZARD_STEPS.length} — {step.title}
        </p>

        <div className="mt-6 flex gap-1">
          {WIZARD_STEPS.map((item, index) => (
            <div
              key={item.id}
              className={`h-1 flex-1 rounded-full ${
                index <= stepIndex ? "bg-accent/70" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="mt-10">{stepContent}</div>

        {statusMessage && (
          <p className="mt-6 text-sm text-muted">{statusMessage}</p>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="min-h-[48px] rounded-full border border-border px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted disabled:opacity-40"
          >
            Back
          </button>
          {stepIndex < WIZARD_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i + 1)}
              className="min-h-[48px] rounded-full border border-accent/30 bg-accent/[0.1] px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-accent"
            >
              Continue
            </button>
          ) : (
            <Link
              href={ROUTES.hq}
              className="inline-flex min-h-[48px] items-center rounded-full border border-accent/30 bg-accent/[0.12] px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-accent"
            >
              Return to Headquarters
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
