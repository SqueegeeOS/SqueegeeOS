"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  formatStarRating,
  fromPlaceSearchCandidate,
  type BusinessConnectOption,
} from "@/lib/reviews/business-connect";
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

function BusinessConnectList({
  businesses,
  connectedPlaceId,
  onConnect,
  connectingPlaceId,
}: {
  businesses: BusinessConnectOption[];
  connectedPlaceId: string;
  onConnect: (business: BusinessConnectOption) => void;
  connectingPlaceId?: string | null;
}) {
  if (businesses.length === 0) return null;

  return (
    <div className="space-y-3">
      {businesses.map((business) => {
        const connected = connectedPlaceId === business.placeId;
        const connecting = connectingPlaceId === business.placeId;
        const stars = formatStarRating(business.rating);

        return (
          <article
            key={business.placeId}
            className={`rounded-[1.25rem] border px-5 py-4 transition-colors ${
              connected
                ? "border-accent/40 bg-accent/[0.08]"
                : "border-border bg-background/40"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-xl font-light text-foreground">
                    {business.name}
                  </h3>
                  {business.isVerified && (
                    <span className="rounded-full border border-accent/25 bg-accent/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-accent">
                      Verified Business
                    </span>
                  )}
                  {business.isServiceAreaBusiness && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted">
                      Service area
                    </span>
                  )}
                </div>
                {stars && (
                  <p className="mt-2 text-sm text-accent">
                    {stars}
                    {business.reviewCount != null && business.reviewCount > 0
                      ? ` · ${business.reviewCount} Reviews`
                      : ""}
                  </p>
                )}
                {business.category && (
                  <p className="mt-1 text-xs text-foreground/80">{business.category}</p>
                )}
                {business.locationLabel && (
                  <p className="mt-1 text-xs text-muted">{business.locationLabel}</p>
                )}
                {business.website && (
                  <p className="mt-1 text-xs text-muted/80">{business.website}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onConnect(business)}
                disabled={connecting || connected}
                className="shrink-0 rounded-full border border-accent/30 bg-accent/[0.12] px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-accent disabled:opacity-50"
              >
                {connected ? "Connected" : connecting ? "Connecting…" : "Connect"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BusinessCandidateList({
  candidates,
  selectedPlaceId,
  onSelect,
  connectingPlaceId,
}: {
  candidates: PlaceSearchCandidate[];
  selectedPlaceId: string;
  onSelect: (candidate: PlaceSearchCandidate) => void;
  connectingPlaceId?: string | null;
}) {
  return (
    <BusinessConnectList
      businesses={candidates.map(fromPlaceSearchCandidate)}
      connectedPlaceId={selectedPlaceId}
      onConnect={(business) =>
        onSelect({
          placeId: business.placeId,
          name: business.name,
          locationLabel: business.locationLabel ?? "",
          isServiceAreaBusiness: business.isServiceAreaBusiness ?? false,
          rating: business.rating,
          reviewCount: business.reviewCount,
          website: business.website,
          phone: undefined,
        })
      }
      connectingPlaceId={connectingPlaceId}
    />
  );
}

export function GoogleReviewsSetupWizard() {
  const searchParams = useSearchParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<GoogleReviewsWizardState>(DEFAULT_WIZARD_STATE);
  const [searchResults, setSearchResults] = useState<PlaceSearchCandidate[]>([]);
  const [managedBusinesses, setManagedBusinesses] = useState<BusinessConnectOption[]>([]);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthEmail, setOauthEmail] = useState<string | null>(null);
  const [loadingManaged, setLoadingManaged] = useState(false);
  const [connectingPlaceId, setConnectingPlaceId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [testResult, setTestResult] = useState<GoogleReviewsTestResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const step = WIZARD_STEPS[stepIndex];
  const findStepIndex = WIZARD_STEPS.findIndex((item) => item.id === "find");
  const testStepIndex = WIZARD_STEPS.findIndex((item) => item.id === "test");

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

  const runTest = useCallback(
    async (overrides?: { placeId?: string; apiKey?: string }) => {
      const placeId = overrides?.placeId ?? state.placeId;
      const apiKey = overrides?.apiKey ?? state.apiKey;
      setTesting(true);
      setStatusMessage(null);
      setTestResult(null);
      try {
        const response = await fetch("/api/admin/google-reviews/test", {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            apiKey,
            placeId,
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
            placeId,
          });
        } else {
          update({ testPassed: false, placeId });
        }
        return json;
      } catch {
        setStatusMessage(
          "Connection test failed. Check your PIN session and try again.",
        );
        return null;
      } finally {
        setTesting(false);
      }
    },
    [state.apiKey, state.businessName, state.placeId, update],
  );

  const loadOAuthStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/google-reviews/oauth/status", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) return;
      const json = (await response.json()) as {
        configured: boolean;
        connected: boolean;
        email?: string | null;
      };
      setOauthConfigured(json.configured);
      setOauthConnected(json.connected);
      setOauthEmail(json.email ?? null);
      return json;
    } catch {
      return null;
    }
  }, []);

  const loadManagedBusinesses = useCallback(async () => {
    setLoadingManaged(true);
    try {
      const params = new URLSearchParams();
      if (state.apiKey.trim()) {
        params.set("apiKey", state.apiKey.trim());
      }
      const response = await fetch(
        `/api/admin/google-reviews/my-businesses?${params.toString()}`,
        {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        },
      );
      if (!response.ok) {
        if (response.status === 401) {
          setOauthConnected(false);
          setManagedBusinesses([]);
        }
        return;
      }
      const json = (await response.json()) as {
        businesses: BusinessConnectOption[];
        email?: string | null;
        warning?: string;
      };
      setManagedBusinesses(json.businesses);
      setOauthEmail(json.email ?? null);
      setOauthConnected(true);
      if (json.warning && json.businesses.length === 0) {
        setStatusMessage(json.warning);
      }
    } finally {
      setLoadingManaged(false);
    }
  }, [state.apiKey]);

  const connectBusiness = useCallback(
    async (business: BusinessConnectOption) => {
      setConnectingPlaceId(business.placeId);
      setStatusMessage(null);

      update({
        placeId: business.placeId,
        businessName: business.name,
        lastRating: business.rating ?? null,
        lastReviewCount: business.reviewCount ?? null,
        testPassed: false,
      });

      if (state.apiKey.trim()) {
        const testResponse = await runTest({
          placeId: business.placeId,
          apiKey: state.apiKey,
        });
        if (testResponse?.placeIdValid) {
          setStatusMessage(`Connected to ${business.name}. Live reviews confirmed.`);
          setStepIndex(testStepIndex);
        } else {
          setStatusMessage(
            `Connected to ${business.name}. Test your API key on the next step.`,
          );
          setStepIndex(testStepIndex);
        }
      } else {
        setStatusMessage(
          `Connected to ${business.name}. Your Place ID is saved — add your API key on step 4, then test.`,
        );
        setStepIndex(testStepIndex);
      }

      setConnectingPlaceId(null);
    },
    [runTest, state.apiKey, testStepIndex, update],
  );

  const handleUseGoogleBusiness = useCallback(() => {
    window.location.href = "/api/admin/google-reviews/oauth/start";
  }, []);

  useEffect(() => {
    void loadOAuthStatus();
  }, [loadOAuthStatus]);

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    if (oauth === "connected") {
      setStepIndex(findStepIndex);
      setStatusMessage("Google sign-in complete. Loading your businesses…");
      void loadOAuthStatus().then((status) => {
        if (status?.connected) {
          void loadManagedBusinesses();
        }
      });
    } else if (oauth === "error") {
      setStatusMessage(
        "Google sign-in did not complete. Try again, or use search below.",
      );
    }
  }, [findStepIndex, loadManagedBusinesses, loadOAuthStatus, searchParams]);

  useEffect(() => {
    if (step.id === "find" && oauthConnected) {
      void loadManagedBusinesses();
    }
  }, [loadManagedBusinesses, oauthConnected, step.id, state.apiKey]);

  const runBusinessSearch = useCallback(
    async (serviceAreaMode: boolean) => {
      if (!state.apiKey.trim()) {
        setStatusMessage("Enter your API key on step 4 first.");
        return;
      }
      if (
        !state.searchQuery.trim() &&
        !state.searchPhone.trim() &&
        !state.searchWebsite.trim()
      ) {
        setStatusMessage("Enter a business name, phone number, or website to search.");
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
            phone: state.searchPhone,
            website: state.searchWebsite,
            serviceAreaMode,
          }),
        });
        if (!response.ok) throw new Error("Search failed");
        const json = (await response.json()) as { results: PlaceSearchCandidate[] };
        setSearchResults(json.results);
        if (json.results.length === 0) {
          setStatusMessage(
            serviceAreaMode
              ? "No service-area matches yet. Double-check your business name, phone, or website — or paste your Google share link in Option B."
              : "No results. Try “I have a Service Area Business” if you hide your address on Google.",
          );
        } else if (json.results.length === 1) {
          setStatusMessage(
            `Found ${json.results[0].name}. Tap “Use this business” to confirm.`,
          );
        } else {
          setStatusMessage(`Found ${json.results.length} possible matches. Pick yours below.`);
        }
      } catch {
        setStatusMessage(
          "Search failed. Confirm your API key and that Places API is enabled.",
        );
      } finally {
        setSearching(false);
      }
    },
    [
      state.apiKey,
      state.searchPhone,
      state.searchQuery,
      state.searchWebsite,
    ],
  );

  const handleSearch = useCallback(async () => {
    await runBusinessSearch(false);
  }, [runBusinessSearch]);

  const handleServiceAreaSearch = useCallback(async () => {
    await runBusinessSearch(true);
  }, [runBusinessSearch]);

  const selectBusiness = useCallback(
    (candidate: PlaceSearchCandidate) => {
      void connectBusiness(fromPlaceSearchCandidate(candidate));
    },
    [connectBusiness],
  );

  const handleResolveUrl = useCallback(async () => {
    if (!state.mapsUrl.trim()) return;
    if (!state.apiKey.trim()) {
      setStatusMessage("Enter your API key on step 4 first — we need it to look up your business.");
      return;
    }

    setResolving(true);
    setStatusMessage(null);
    setSearchResults([]);
    try {
      const response = await fetch("/api/admin/google-reviews/resolve-url", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          url: state.mapsUrl,
          apiKey: state.apiKey,
          phone: state.searchPhone,
          website: state.searchWebsite,
        }),
      });
      if (!response.ok) throw new Error("Could not resolve URL");
      const json = (await response.json()) as {
        placeId: string | null;
        resolvedUrl: string;
        found: boolean;
        needsSelection?: boolean;
        candidates?: PlaceSearchCandidate[];
        businessNameHint?: string | null;
        method?: "url" | "search" | "none";
      };

      if (json.candidates?.length) {
        setSearchResults(json.candidates);
      }

      if (json.found && json.placeId) {
        const match =
          json.candidates?.find((item) => item.placeId === json.placeId) ??
          json.candidates?.[0];
        update({
          placeId: json.placeId,
          businessName: match?.name ?? json.businessNameHint ?? state.businessName,
          testPassed: false,
        });
        setStatusMessage(
          json.method === "search"
            ? `Found ${match?.name ?? "your business"} via Google search.`
            : "Found your business from that link.",
        );
        return;
      }

      if (json.needsSelection && json.candidates?.length) {
        setStatusMessage(
          json.businessNameHint
            ? `We found possible matches for “${json.businessNameHint}”. Pick yours below.`
            : "We found possible matches. Pick your business below.",
        );
        return;
      }

      setStatusMessage(
        json.businessNameHint
          ? `Could not confirm your business from that link. Try searching for “${json.businessNameHint}” in Option A.`
          : "Could not find your business from that link. Try Option A — search by name.",
      );
    } catch {
      setStatusMessage("Could not resolve that URL. Try searching by business name in Option A.");
    } finally {
      setResolving(false);
    }
  }, [state.apiKey, state.businessName, state.mapsUrl, state.searchPhone, state.searchWebsite, update]);

  const handleTest = useCallback(async () => {
    await runTest();
  }, [runTest]);

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
              <li>
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.businessProfileApi}>
                  Business Profile API
                </ExternalLink>{" "}
                → Enable (for “Use my Google Business”)
              </li>
              <li>
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.businessAccountApi}>
                  My Business Account Management API
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
          <StepCard title="Connect your Google Business">
            <p className="text-xs leading-relaxed text-muted">
              You should never need to hunt for a Place ID. If you own
              SqueegeeKing on Google, sign in and tap Connect.
            </p>

            <div className="rounded-[1.25rem] border border-accent/20 bg-accent/[0.05] p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-accent">
                Recommended
              </p>
              <p className="mt-3 text-sm text-foreground/90">
                Use the Google account that owns your Business Profile.
              </p>
              {oauthConfigured ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleUseGoogleBusiness}
                    className="rounded-full border border-accent/30 bg-accent/[0.12] px-6 py-3.5 text-[10px] uppercase tracking-[0.2em] text-accent"
                  >
                    Use my Google Business
                  </button>
                  {oauthConnected && oauthEmail && (
                    <span className="self-center text-xs text-muted">
                      Signed in as {oauthEmail}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Google sign-in is not configured yet. Add{" "}
                  <code className="text-foreground/80">GOOGLE_OAUTH_CLIENT_ID</code>{" "}
                  and{" "}
                  <code className="text-foreground/80">GOOGLE_OAUTH_CLIENT_SECRET</code>{" "}
                  in Vercel, enable the Business Profile APIs, and use search
                  below meanwhile.
                </p>
              )}
            </div>

            {loadingManaged && (
              <p className="text-sm text-muted">Loading your Google businesses…</p>
            )}

            {managedBusinesses.length > 0 && (
              <BusinessConnectList
                businesses={managedBusinesses}
                connectedPlaceId={state.placeId}
                onConnect={(business) => void connectBusiness(business)}
                connectingPlaceId={connectingPlaceId}
              />
            )}

            <div className="border-t border-border/60 pt-5">
              <p className="text-foreground/90">Or search manually</p>
              <p className="mt-2 text-xs text-muted">
                For service area businesses with no public address — search by
                name, phone, or website.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-muted">
                  Business name
                </label>
                <input
                  className={inputClassName}
                  value={state.searchQuery}
                  onChange={(e) => update({ searchQuery: e.target.value })}
                  placeholder="SqueegeeKing"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-muted">
                  Phone (optional)
                </label>
                <input
                  className={inputClassName}
                  value={state.searchPhone}
                  onChange={(e) => update({ searchPhone: e.target.value })}
                  placeholder="(530) 555-0100"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-muted">
                  Website (optional)
                </label>
                <input
                  className={inputClassName}
                  value={state.searchWebsite}
                  onChange={(e) => update({ searchWebsite: e.target.value })}
                  placeholder="squeegeeking.net"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searching}
                className="rounded-full border border-accent/30 bg-accent/[0.1] px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-accent disabled:opacity-50"
              >
                {searching ? "Searching…" : "Search Google"}
              </button>
              <button
                type="button"
                onClick={() => void handleServiceAreaSearch()}
                disabled={searching}
                className="rounded-full border border-border px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
              >
                I have a Service Area Business
              </button>
            </div>
            {searchResults.length > 0 && (
              <BusinessCandidateList
                candidates={searchResults}
                selectedPlaceId={state.placeId}
                onSelect={selectBusiness}
                connectingPlaceId={connectingPlaceId}
              />
            )}

            <details className="rounded-[1.25rem] border border-border/70 bg-background/30 p-4">
              <summary className="cursor-pointer text-sm text-foreground/90">
                More options (share link or advanced)
              </summary>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-muted">
                    Paste a share.google, g.page, or Maps link.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      className={inputClassName}
                      value={state.mapsUrl}
                      onChange={(e) => update({ mapsUrl: e.target.value })}
                      placeholder="https://share.google/..."
                    />
                    <button
                      type="button"
                      onClick={() => void handleResolveUrl()}
                      disabled={resolving}
                      className="shrink-0 rounded-full border border-border px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
                    >
                      {resolving ? "Finding…" : "Find my business"}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted">Advanced: Place ID (rarely needed)</p>
                  <input
                    className={`${inputClassName} mt-3`}
                    value={state.placeId}
                    onChange={(e) =>
                      update({ placeId: e.target.value, testPassed: false })
                    }
                    placeholder="ChIJ..."
                  />
                </div>
              </div>
            </details>

            {state.placeId && state.businessName && (
              <p className="text-xs text-accent">
                Connected: {state.businessName}
                {state.lastReviewCount
                  ? ` · ${state.lastRating ?? "—"} stars · ${state.lastReviewCount} reviews`
                  : ""}
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
    connectBusiness,
    handleResolveUrl,
    handleSearch,
    handleServiceAreaSearch,
    handleTest,
    handleUseGoogleBusiness,
    loadingManaged,
    managedBusinesses,
    oauthConfigured,
    oauthConnected,
    oauthEmail,
    connectingPlaceId,
    resolving,
    searchResults,
    searching,
    selectBusiness,
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
