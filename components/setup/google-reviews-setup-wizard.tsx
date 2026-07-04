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
import type { PlacesSearchDiagnostic } from "@/lib/reviews/places-search-debug";
import type { ResolveUrlDiagnostic } from "@/lib/reviews/resolve-url-debug";
import { GoogleOAuthSetupGuide } from "@/components/setup/google-oauth-setup-guide";
import type { GbpApiDiagnostic } from "@/lib/reviews/google-business-profile";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/reviews/google-oauth-config";
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

function PlaceConnectConfirmation({
  business,
  productionPlaceId,
  confirming,
  onCancel,
  onConfirm,
}: {
  business: BusinessConnectOption;
  productionPlaceId?: string | null;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const stars = formatStarRating(business.rating);
  const sameAsProduction =
    productionPlaceId && productionPlaceId === business.placeId;

  return (
    <div className="rounded-[1.25rem] border border-accent/30 bg-accent/[0.06] p-5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-accent">
        Confirm Place ID before saving
      </p>
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">
        Verify this is Noah&apos;s SqueegeeKing Google Business Profile (~5.0
        stars, ~116 reviews). This Place ID will be copied into{" "}
        <code className="text-xs">GOOGLE_PLACE_ID</code> for production.
      </p>
      <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm">
        <p className="font-serif text-xl font-light text-foreground">
          {business.name}
        </p>
        {stars && (
          <p className="text-accent">
            {stars}
            {business.reviewCount != null
              ? ` · ${business.reviewCount} reviews`
              : ""}
          </p>
        )}
        {business.locationLabel && (
          <p className="text-xs text-muted">{business.locationLabel}</p>
        )}
        <p className="font-mono text-[11px] text-muted break-all">
          Place ID: {business.placeId}
        </p>
      </div>
      {sameAsProduction && (
        <p className="mt-3 text-xs text-muted">
          This matches the Place ID already configured in production.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="rounded-full border border-accent/30 bg-accent/[0.12] px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-accent disabled:opacity-50"
        >
          {confirming ? "Confirming…" : "Confirm & save Place ID"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="rounded-full border border-border px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function GbpListDiagnosticPanel({
  email,
  diagnostic,
  oauthScopesRequested,
  gbpApiAccessUrl,
}: {
  email?: string | null;
  diagnostic: GbpApiDiagnostic | null;
  oauthScopesRequested?: string;
  gbpApiAccessUrl?: string | null;
}) {
  if (!diagnostic) return null;

  const isApiIssue =
    diagnostic.failureKind === "api_access_blocked" ||
    diagnostic.failureKind === "locations_request_failed" ||
    diagnostic.needsApiApproval;
  const isAccountIssue =
    diagnostic.failureKind === "zero_accounts" ||
    diagnostic.failureKind === "zero_locations";

  return (
    <div className="space-y-4 rounded-[1.25rem] border border-amber-500/30 bg-amber-500/[0.06] p-5 text-xs leading-relaxed text-muted">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700">
          Business Profile list diagnostics
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
            isApiIssue
              ? "border-amber-600/40 text-amber-800"
              : isAccountIssue
                ? "border-border text-muted"
                : "border-border text-muted"
          }`}
        >
          {isApiIssue ? "Likely API / scopes" : isAccountIssue ? "Check account" : diagnostic.failureKind}
        </span>
      </div>

      <p className="text-sm text-foreground/90">{diagnostic.interpretation}</p>

      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="uppercase tracking-[0.16em]">Signed-in email</dt>
          <dd className="mt-1 text-foreground/90">{email ?? "unknown"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em]">business.manage scope</dt>
          <dd className="mt-1 text-foreground/90">
            {diagnostic.hasBusinessManageScope ? "present" : "missing"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="uppercase tracking-[0.16em]">Scopes on token</dt>
          <dd className="mt-1 break-all font-mono text-[10px] text-foreground/80">
            {diagnostic.oauthScopes ?? "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="uppercase tracking-[0.16em]">Scopes we request</dt>
          <dd className="mt-1 break-all font-mono text-[10px] text-foreground/80">
            {oauthScopesRequested ?? GOOGLE_OAUTH_SCOPES.join(" ")}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em]">Accounts HTTP</dt>
          <dd className="mt-1 text-foreground/90">
            {diagnostic.accountsHttpStatus ?? "—"}
            {diagnostic.accountCount != null
              ? ` · ${diagnostic.accountCount} account(s)`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em]">Locations HTTP</dt>
          <dd className="mt-1 text-foreground/90">
            {diagnostic.locationsHttpStatus ?? "—"}
            {diagnostic.locationCount != null
              ? ` · ${diagnostic.locationCount} location(s)`
              : ""}
          </dd>
        </div>
      </dl>

      {diagnostic.accountsError && (
        <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-amber-900">
          Accounts API: {diagnostic.accountsError}
        </p>
      )}
      {diagnostic.locationsError && (
        <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-amber-900">
          Locations API: {diagnostic.locationsError}
        </p>
      )}

      {diagnostic.accountsRaw && diagnostic.accountsRaw.length > 0 && (
        <div>
          <p className="mb-2 uppercase tracking-[0.16em]">Accounts returned</p>
          <ul className="space-y-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
            {diagnostic.accountsRaw.map((account) => (
              <li key={account.name ?? account.accountName} className="text-foreground/85">
                {account.accountName ?? account.name ?? "Account"}
                {account.type ? ` · ${account.type}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnostic.locationPreviews && diagnostic.locationPreviews.length > 0 && (
        <div>
          <p className="mb-2 uppercase tracking-[0.16em]">Locations returned</p>
          <ul className="space-y-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
            {diagnostic.locationPreviews.map((location) => (
              <li key={`${location.accountName}-${location.title}`}>
                {location.title ?? "Untitled"}
                {location.placeId ? ` · Place ID present` : " · no Place ID"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnostic.accountsResponseSnippet && (
        <details>
          <summary className="cursor-pointer text-foreground/85">
            Raw accounts response (truncated)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-background/40 p-3 font-mono text-[10px] text-foreground/80">
            {diagnostic.accountsResponseSnippet}
          </pre>
        </details>
      )}

      <p className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
        Endpoint: {diagnostic.accountsEndpoint}
      </p>

      {isApiIssue && gbpApiAccessUrl && (
        <a
          href={gbpApiAccessUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full border border-accent/30 bg-accent/[0.12] px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-accent"
        >
          Request Business Profile API access ↗
        </a>
      )}

      {!isApiIssue && isAccountIssue && (
        <p>
          Confirm{" "}
          <a
            href="https://business.google.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            business.google.com
          </a>{" "}
          shows SqueegeeKing for <strong className="text-foreground">{email}</strong>.
        </p>
      )}
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

function SearchDiagnosticsPanel({
  searchDiagnostic,
  resolveDiagnostic,
  serverEnvKeyPresent,
}: {
  searchDiagnostic: PlacesSearchDiagnostic | null;
  resolveDiagnostic: ResolveUrlDiagnostic | null;
  serverEnvKeyPresent?: boolean;
}) {
  if (!searchDiagnostic && !resolveDiagnostic) return null;

  return (
    <div className="space-y-4 rounded-[1.25rem] border border-amber-500/25 bg-amber-500/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-600">
          Search diagnostics
        </p>
        <p className="text-xs text-muted">
          GOOGLE_MAPS_API_KEY on server:{" "}
          <span className="text-foreground">
            {serverEnvKeyPresent ?? searchDiagnostic?.serverEnvKeyPresent
              ? "present"
              : "missing"}
          </span>
        </p>
      </div>

      {searchDiagnostic && (
        <div className="space-y-3 text-xs text-muted">
          <p>
            API key source:{" "}
            <span className="text-foreground">{searchDiagnostic.apiKeySource}</span>
            {searchDiagnostic.apiKeyMasked
              ? ` · masked: ${searchDiagnostic.apiKeyMasked}`
              : ""}
          </p>
          <div>
            <p className="text-foreground/90">Queries sent to Google</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {searchDiagnostic.queriesAttempted.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
          </div>
          <p>
            Merged candidates:{" "}
            <span className="text-foreground">
              {searchDiagnostic.mergedCandidateCount}
            </span>
          </p>
          {searchDiagnostic.mergedCandidates.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/40">
              <table className="min-w-full text-left text-[11px]">
                <thead className="border-b border-border/60 text-muted">
                  <tr>
                    <th className="px-3 py-2 font-normal">Name</th>
                    <th className="px-3 py-2 font-normal">Reviews</th>
                    <th className="px-3 py-2 font-normal">Rating</th>
                    <th className="px-3 py-2 font-normal">Website</th>
                    <th className="px-3 py-2 font-normal">Phone</th>
                    <th className="px-3 py-2 font-normal">SAB</th>
                  </tr>
                </thead>
                <tbody>
                  {searchDiagnostic.mergedCandidates.map((candidate) => (
                    <tr key={candidate.placeId} className="border-b border-border/40">
                      <td className="px-3 py-2 text-foreground">{candidate.name}</td>
                      <td className="px-3 py-2">{candidate.reviewCount ?? "—"}</td>
                      <td className="px-3 py-2">{candidate.rating ?? "—"}</td>
                      <td className="px-3 py-2">{candidate.website ?? "—"}</td>
                      <td className="px-3 py-2">{candidate.phone ?? "—"}</td>
                      <td className="px-3 py-2">
                        {candidate.isServiceAreaBusiness ? "yes" : "no"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {searchDiagnostic.attempts.map((attempt, index) => (
            <details
              key={`${attempt.api}-${attempt.query}-${index}`}
              className="rounded-lg border border-border/50 bg-background/30 px-3 py-2"
            >
              <summary className="cursor-pointer text-foreground/90">
                {attempt.api} · “{attempt.query}” · {attempt.rawCandidateCount}{" "}
                raw · HTTP {attempt.httpStatus}
                {attempt.googleStatus ? ` · ${attempt.googleStatus}` : ""}
              </summary>
              {attempt.errorMessage && (
                <p className="mt-2 text-amber-700">{attempt.errorMessage}</p>
              )}
              {attempt.requestSummary && (
                <p className="mt-2 break-all font-mono text-[10px] text-muted">
                  {attempt.requestSummary}
                </p>
              )}
            </details>
          ))}
          {searchDiagnostic.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-amber-700">
              {searchDiagnostic.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {resolveDiagnostic && (
        <div className="space-y-2 border-t border-border/50 pt-4 text-xs text-muted">
          <p className="text-foreground/90">Share link resolve</p>
          <p>Input: {resolveDiagnostic.inputUrl}</p>
          <p>Resolved: {resolveDiagnostic.resolvedUrl}</p>
          <p>
            Place ID:{" "}
            <span className="text-foreground">
              {resolveDiagnostic.placeId ?? "not found"}
            </span>
          </p>
          {resolveDiagnostic.businessNameHint && (
            <p>Name hint: {resolveDiagnostic.businessNameHint}</p>
          )}
          {resolveDiagnostic.redirectChain.length > 1 && (
            <p>Redirects: {resolveDiagnostic.redirectChain.join(" → ")}</p>
          )}
          {resolveDiagnostic.notes.map((note) => (
            <p key={note} className="text-amber-700">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function GoogleReviewsSetupWizard() {
  const searchParams = useSearchParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<GoogleReviewsWizardState>(DEFAULT_WIZARD_STATE);
  const [searchResults, setSearchResults] = useState<PlaceSearchCandidate[]>([]);
  const [managedBusinesses, setManagedBusinesses] = useState<BusinessConnectOption[]>([]);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [oauthClientIdConfigured, setOauthClientIdConfigured] = useState(false);
  const [oauthClientSecretConfigured, setOauthClientSecretConfigured] =
    useState(false);
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [oauthChecking, setOauthChecking] = useState(false);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthEmail, setOauthEmail] = useState<string | null>(null);
  const [loadingManaged, setLoadingManaged] = useState(false);
  const [connectingPlaceId, setConnectingPlaceId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [testResult, setTestResult] = useState<
    (GoogleReviewsTestResult & {
      likelySqueegeeKing?: boolean;
      mismatchReason?: string | null;
      placeId?: string;
    }) | null
  >(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchDiagnostic, setSearchDiagnostic] =
    useState<PlacesSearchDiagnostic | null>(null);
  const [resolveDiagnostic, setResolveDiagnostic] =
    useState<ResolveUrlDiagnostic | null>(null);
  const [serverEnvKeyPresent, setServerEnvKeyPresent] = useState(false);
  const [pendingConnect, setPendingConnect] =
    useState<BusinessConnectOption | null>(null);
  const [productionPlaceId, setProductionPlaceId] = useState<string | null>(null);
  const [gbpApiAccessUrl, setGbpApiAccessUrl] = useState<string | null>(null);
  const [gbpNeedsApproval, setGbpNeedsApproval] = useState(false);
  const [gbpDiagnostic, setGbpDiagnostic] = useState<GbpApiDiagnostic | null>(
    null,
  );
  const [oauthScopesRequested, setOauthScopesRequested] = useState<
    string | null
  >(null);

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
    async (overrides?: {
      placeId?: string;
      apiKey?: string;
      source?: string;
      businessNameHint?: string;
    }) => {
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
            source: overrides?.source ?? "manual_test",
            businessNameHint:
              overrides?.businessNameHint ?? state.businessName ?? undefined,
          }),
        });
        if (!response.ok) throw new Error("Test request failed");
        const json = (await response.json()) as GoogleReviewsTestResult & {
          likelySqueegeeKing?: boolean;
          mismatchReason?: string | null;
          placeId?: string;
        };
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

  const loadProductionPlaceStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/google-reviews/status", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) return;
      const json = (await response.json()) as {
        configured?: boolean;
        placeId?: string | null;
        likelySqueegeeKing?: boolean;
        mismatchReason?: string | null;
        businessName?: string | null;
        rating?: number | null;
        reviewCount?: number | null;
      };
      setProductionPlaceId(json.placeId ?? null);
      if (json.configured && json.likelySqueegeeKing === false && json.mismatchReason) {
        setStatusMessage(
          `Production GOOGLE_PLACE_ID currently resolves to ${json.businessName ?? "another business"}${json.rating != null && json.reviewCount != null ? ` (${json.rating.toFixed(1)}★ · ${json.reviewCount} reviews)` : ""}. Reconnect SqueegeeKing below.`,
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const loadOAuthStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setOauthChecking(true);
    try {
      const response = await fetch("/api/admin/google-reviews/oauth/status", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) return null;
      const json = (await response.json()) as {
        configured: boolean;
        connected: boolean;
        email?: string | null;
        redirectUri?: string;
        clientIdConfigured?: boolean;
        clientSecretConfigured?: boolean;
      };
      setOauthConfigured((wasConfigured) => {
        if (!wasConfigured && json.configured) {
          setStatusMessage(
            "Google sign-in is ready. Click Sign in with Google Business below.",
          );
        }
        return json.configured;
      });
      setOauthClientIdConfigured(Boolean(json.clientIdConfigured));
      setOauthClientSecretConfigured(Boolean(json.clientSecretConfigured));
      if (json.redirectUri) setOauthRedirectUri(json.redirectUri);
      setOauthConnected(json.connected);
      setOauthEmail(json.email ?? null);
      return json;
    } catch {
      return null;
    } finally {
      if (!options?.silent) setOauthChecking(false);
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
        gbpApiAccessUrl?: string;
        oauthScopesRequested?: string;
        diagnostic?: GbpApiDiagnostic;
        serverEnvKeyPresent?: boolean;
      };
      setManagedBusinesses(json.businesses);
      setOauthEmail(json.email ?? null);
      setOauthConnected(true);
      setGbpDiagnostic(json.diagnostic ?? null);
      setOauthScopesRequested(json.oauthScopesRequested ?? null);
      setGbpNeedsApproval(Boolean(json.diagnostic?.needsApiApproval));
      setGbpApiAccessUrl(json.gbpApiAccessUrl ?? null);
      if (json.serverEnvKeyPresent !== undefined) {
        setServerEnvKeyPresent(json.serverEnvKeyPresent);
      }
      if (json.warning && json.businesses.length === 0) {
        setStatusMessage(json.warning);
      } else if (json.businesses.length > 0) {
        setGbpNeedsApproval(false);
      }
    } finally {
      setLoadingManaged(false);
    }
  }, [state.apiKey]);

  const connectBusiness = useCallback(
    async (business: BusinessConnectOption) => {
      setConnectingPlaceId(business.placeId);
      setStatusMessage(null);
      setPendingConnect(null);

      update({
        placeId: business.placeId,
        businessName: business.name,
        lastRating: business.rating ?? null,
        lastReviewCount: business.reviewCount ?? null,
        testPassed: false,
      });

      const source =
        business.source === "google_business"
          ? "oauth_connect"
          : "places_search";

      const testResponse = await runTest({
        placeId: business.placeId,
        source,
        businessNameHint: business.name,
      });

      if (testResponse?.placeIdValid && testResponse.reviewsFound) {
        setStatusMessage(
          `Confirmed ${business.name} · Place ID ${business.placeId} · ${testResponse.rating?.toFixed(1) ?? "—"}★ · ${testResponse.reviewCount ?? "—"} reviews.`,
        );
      } else if (testResponse?.placeIdValid) {
        setStatusMessage(
          `Place ID saved for ${business.name} (${business.placeId}). Confirm live reviews on the next step.`,
        );
      } else {
        setStatusMessage(
          `Place ID ${business.placeId} saved from ${business.name}. Run Test connection on the next step.`,
        );
      }
      setStepIndex(testStepIndex);
      setConnectingPlaceId(null);
    },
    [runTest, testStepIndex, update],
  );

  const requestConnect = useCallback((business: BusinessConnectOption) => {
    setPendingConnect(business);
    setStatusMessage(null);
  }, []);

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
        "Google sign-in did not complete. Try again — this is the recommended way to connect service-area businesses.",
      );
    }
  }, [findStepIndex, loadManagedBusinesses, loadOAuthStatus, searchParams]);

  useEffect(() => {
    if (step.id === "find") {
      void loadProductionPlaceStatus();
      void loadOAuthStatus().then((status) => {
        if (status?.connected) {
          void loadManagedBusinesses();
        }
      });
    }
  }, [loadManagedBusinesses, loadOAuthStatus, loadProductionPlaceStatus, step.id]);

  useEffect(() => {
    if (step.id !== "find" || oauthConfigured) return;
    const interval = window.setInterval(() => {
      void loadOAuthStatus({ silent: true });
    }, 8000);
    return () => window.clearInterval(interval);
  }, [loadOAuthStatus, oauthConfigured, step.id]);

  const runBusinessSearch = useCallback(
    async (serviceAreaMode: boolean) => {
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
      setResolveDiagnostic(null);
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
            diagnostic: state.diagnosticMode,
          }),
        });
        if (!response.ok) throw new Error("Search failed");
        const json = (await response.json()) as {
          results: PlaceSearchCandidate[];
          diagnostic?: PlacesSearchDiagnostic;
        };
        setSearchResults(json.results);
        if (json.diagnostic) {
          setSearchDiagnostic(json.diagnostic);
          setServerEnvKeyPresent(json.diagnostic.serverEnvKeyPresent);
        }
        if (!json.diagnostic?.apiKeyMasked && json.diagnostic?.apiKeySource === "none") {
          setStatusMessage(
            "No API key available. Paste your key in step 4 or set GOOGLE_MAPS_API_KEY in Vercel.",
          );
          return;
        }
        if (json.results.length === 0) {
          setStatusMessage(
            serviceAreaMode
              ? "No service-area matches yet. Check diagnostics below, paste your Google share link, or save it as pending."
              : "No results. Try “I have a Service Area Business” or check diagnostics below.",
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
      state.diagnosticMode,
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
      requestConnect(fromPlaceSearchCandidate(candidate));
    },
    [requestConnect],
  );

  const handleResolveUrl = useCallback(
    async (options?: { pendingOnly?: boolean }) => {
      const url = options?.pendingOnly ? state.pendingShareUrl : state.mapsUrl;
      if (!url.trim()) return;

      setResolving(true);
      setStatusMessage(null);
      if (!options?.pendingOnly) setSearchResults([]);
      try {
        const endpoint = state.diagnosticMode
          ? "/api/admin/google-reviews/resolve-url/debug"
          : "/api/admin/google-reviews/resolve-url";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            url,
            apiKey: state.apiKey,
            phone: state.searchPhone,
            website: state.searchWebsite,
            query: state.searchQuery,
            pendingOnly: Boolean(options?.pendingOnly),
          }),
        });
        if (!response.ok) throw new Error("Could not resolve URL");
        const json = (await response.json()) as {
          placeId: string | null;
          resolvedUrl?: string;
          found: boolean;
          needsSelection?: boolean;
          candidates?: PlaceSearchCandidate[];
          businessNameHint?: string | null;
          method?: "url" | "search" | "none";
          resolveDiagnostic?: ResolveUrlDiagnostic;
          searchDiagnostic?: PlacesSearchDiagnostic;
          serverEnvKeyPresent?: boolean;
        };

        if (json.resolveDiagnostic) setResolveDiagnostic(json.resolveDiagnostic);
        if (json.searchDiagnostic) setSearchDiagnostic(json.searchDiagnostic);
        if (json.serverEnvKeyPresent !== undefined) {
          setServerEnvKeyPresent(json.serverEnvKeyPresent);
        }

        if (json.candidates?.length) {
          setSearchResults(json.candidates);
        }

        if (options?.pendingOnly) {
          setStatusMessage(
            json.found && json.placeId
              ? "Pending share link resolved to a Place ID — connect below."
              : "Share link saved as pending. Diagnostics below show what Google returned.",
          );
          if (json.found && json.placeId) {
            update({
              placeId: json.placeId,
              businessName:
                json.candidates?.[0]?.name ??
                json.businessNameHint ??
                state.businessName,
              testPassed: false,
            });
          }
          return;
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
            ? `Could not confirm your business from that link. Try searching for “${json.businessNameHint}” or save the link as pending.`
            : "Could not find your business from that link. Try search or save the link as pending.",
        );
      } catch {
        setStatusMessage(
          "Could not resolve that URL. Save it as pending to inspect diagnostics.",
        );
      } finally {
        setResolving(false);
      }
    },
    [
      state.apiKey,
      state.businessName,
      state.diagnosticMode,
      state.mapsUrl,
      state.pendingShareUrl,
      state.searchPhone,
      state.searchQuery,
      state.searchWebsite,
      update,
    ],
  );

  const handleSavePendingShareUrl = useCallback(() => {
    if (!state.mapsUrl.trim()) {
      setStatusMessage("Paste a Google share link first.");
      return;
    }
    update({ pendingShareUrl: state.mapsUrl.trim() });
    void handleResolveUrl({ pendingOnly: true });
  }, [handleResolveUrl, state.mapsUrl, update]);

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
              When finished, SqueegeeKing will show your real Google rating and
              review count everywhere reviews appear.
            </p>
            <p className="text-foreground/90">
              If you manage the SqueegeeKing Google Business Profile, you will
              connect with Google — no Place ID hunting required. Public search
              is available only as a fallback for service-area businesses that
              do not appear in Places search.
            </p>
            <p>
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
          <StepCard title="Enable the required Google APIs">
            <p>
              Enable these APIs while your SqueegeeKing project is selected.
              Business Profile APIs are required to connect your owned profile;
              Places APIs fetch live ratings and reviews after connect.
            </p>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.businessProfileApi}>
                  Business Profile API
                </ExternalLink>{" "}
                → Enable (required for Google Business connect)
              </li>
              <li>
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.businessAccountApi}>
                  My Business Account Management API
                </ExternalLink>{" "}
                → Enable
              </li>
              <li>
                Request{" "}
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.gbpApiAccess}>
                  Business Profile Basic API Access
                </ExternalLink>{" "}
                (required — Google approves manually; quota is 0 until then)
              </li>
              <li>
                <ExternalLink href={GOOGLE_CONSOLE_LINKS.placesApiNew}>
                  Places API (New)
                </ExternalLink>{" "}
                → Enable (for live rating &amp; review count)
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
          <StepCard title="Connect Google Business Profile">
            <div className="rounded-[1.25rem] border border-amber-500/25 bg-amber-500/[0.05] p-4">
              <p className="text-sm leading-relaxed text-foreground/90">
                Service-area businesses may not appear in public Places search.
                If you manage this Google Business Profile, use Google Business
                connect instead.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-accent/20 bg-accent/[0.05] p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-accent">
                Step 1 — Connect with Google
              </p>
              <p className="mt-3 text-sm text-foreground/90">
                Sign in with the Google account that manages SqueegeeKing. We
                will list the Business Profiles you own, pull the Place ID
                automatically, and use Places API only to fetch your live rating
                and review count.
              </p>
              {oauthConfigured ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!oauthConnected ? (
                    <button
                      type="button"
                      onClick={handleUseGoogleBusiness}
                      className="rounded-full border border-accent/30 bg-accent/[0.12] px-6 py-3.5 text-[10px] uppercase tracking-[0.2em] text-accent"
                    >
                      Sign in with Google Business
                    </button>
                  ) : (
                    <span className="text-xs text-muted">
                      Signed in{oauthEmail ? ` as ${oauthEmail}` : ""}
                    </span>
                  )}
                  {oauthConnected && (
                    <button
                      type="button"
                      onClick={() => void loadManagedBusinesses()}
                      disabled={loadingManaged}
                      className="rounded-full border border-border px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
                    >
                      {loadingManaged ? "Refreshing…" : "Refresh list"}
                    </button>
                  )}
                </div>
              ) : (
                <GoogleOAuthSetupGuide
                  redirectUri={
                    oauthRedirectUri ||
                    "https://YOUR_DOMAIN/api/admin/google-reviews/oauth/callback"
                  }
                  clientIdConfigured={oauthClientIdConfigured}
                  clientSecretConfigured={oauthClientSecretConfigured}
                  checking={oauthChecking}
                  copied={copied}
                  onCopy={(label, text) => void copyText(label, text)}
                  onCheckAgain={() => void loadOAuthStatus()}
                />
              )}
            </div>

            {loadingManaged && (
              <p className="text-sm text-muted">Loading your Google businesses…</p>
            )}

            {oauthConnected && !loadingManaged && managedBusinesses.length === 0 && (
              <GbpListDiagnosticPanel
                email={oauthEmail}
                diagnostic={gbpDiagnostic}
                oauthScopesRequested={oauthScopesRequested ?? undefined}
                gbpApiAccessUrl={gbpApiAccessUrl}
              />
            )}

            {managedBusinesses.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted">
                  Step 2 — Choose your business
                </p>
                <BusinessConnectList
                  businesses={managedBusinesses}
                  connectedPlaceId={state.placeId}
                  onConnect={requestConnect}
                  connectingPlaceId={connectingPlaceId}
                />
              </div>
            )}

            {pendingConnect && (
              <PlaceConnectConfirmation
                business={pendingConnect}
                productionPlaceId={productionPlaceId}
                confirming={connectingPlaceId === pendingConnect.placeId}
                onCancel={() => setPendingConnect(null)}
                onConfirm={() => void connectBusiness(pendingConnect)}
              />
            )}

            {state.placeId && state.businessName && (
              <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-xs">
                <p className="text-accent">
                  Selected: {state.businessName}
                  {state.lastReviewCount
                    ? ` · ${state.lastRating ?? "—"} stars · ${state.lastReviewCount} reviews`
                    : ""}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted break-all">
                  Place ID: {state.placeId}
                </p>
              </div>
            )}

            <details className="rounded-[1.25rem] border border-border/70 bg-background/30 p-4">
              <summary className="cursor-pointer text-sm text-foreground/90">
                Fallback — public search or share link
              </summary>
              <div className="mt-4 space-y-5">
                <p className="text-xs leading-relaxed text-muted">
                  Only use this if you cannot sign in with Google Business.
                  Public Places search often misses service-area businesses with
                  no public address.
                </p>

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
                    className="rounded-full border border-border px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
                  >
                    {searching ? "Searching…" : "Search Google"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleServiceAreaSearch()}
                    disabled={searching}
                    className="rounded-full border border-border px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
                  >
                    Service area search
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={state.diagnosticMode}
                    onChange={(e) => update({ diagnosticMode: e.target.checked })}
                    className="rounded border-border"
                  />
                  Show search diagnostics
                </label>
                {state.diagnosticMode && (
                  <SearchDiagnosticsPanel
                    searchDiagnostic={searchDiagnostic}
                    resolveDiagnostic={resolveDiagnostic}
                    serverEnvKeyPresent={serverEnvKeyPresent}
                  />
                )}
                {searchResults.length > 0 && (
                  <BusinessCandidateList
                    candidates={searchResults}
                    selectedPlaceId={state.placeId}
                    onSelect={selectBusiness}
                    connectingPlaceId={connectingPlaceId}
                  />
                )}

                <div>
                  <p className="text-xs text-muted">
                    Or paste a share.google, g.page, or Maps link.
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
                      {resolving ? "Finding…" : "Resolve link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSavePendingShareUrl()}
                      disabled={resolving}
                      className="shrink-0 rounded-full border border-amber-500/30 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-amber-700 hover:border-amber-500/50 disabled:opacity-50"
                    >
                      Save pending &amp; debug
                    </button>
                  </div>
                  {state.pendingShareUrl && (
                    <p className="mt-2 text-xs text-amber-700">
                      Pending share link: {state.pendingShareUrl}
                    </p>
                  )}
                </div>
              </div>
            </details>
          </StepCard>
        );
      case "test":
        return (
          <StepCard title="Test your connection">
            <p>
              We will call Places API with your connected Place ID — the same
              way production does — and show your live rating and review count
              before you deploy.
            </p>
            {state.businessName && (
              <p className="text-sm text-foreground/90">
                Connected business: <strong>{state.businessName}</strong>
              </p>
            )}
            {state.placeId && (
              <p className="font-mono text-[11px] text-muted break-all">
                Place ID: {state.placeId}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !state.placeId || (!state.apiKey && !serverEnvKeyPresent)}
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
                    {testResult.mismatchReason && !testResult.likelySqueegeeKing && (
                        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-900">
                          This may not be SqueegeeKing: {testResult.mismatchReason}
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
              Your Place ID was saved when you confirmed your Google Business
              Profile. Copy these values into your environment.
            </p>
            {state.businessName && state.placeId && (
              <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3 text-sm">
                <p className="text-foreground">
                  <strong>{state.businessName}</strong>
                  {state.lastRating != null && state.lastReviewCount != null
                    ? ` · ${state.lastRating.toFixed(1)}★ · ${state.lastReviewCount} reviews`
                    : ""}
                </p>
                <p className="mt-2 font-mono text-[11px] text-muted break-all">
                  GOOGLE_PLACE_ID={state.placeId}
                </p>
              </div>
            )}
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
    handleSavePendingShareUrl,
    handleSearch,
    handleServiceAreaSearch,
    handleTest,
    handleUseGoogleBusiness,
    loadProductionPlaceStatus,
    loadingManaged,
    managedBusinesses,
    oauthConfigured,
    oauthClientIdConfigured,
    oauthClientSecretConfigured,
    oauthRedirectUri,
    oauthChecking,
    oauthConnected,
    oauthEmail,
    gbpApiAccessUrl,
    gbpDiagnostic,
    loadManagedBusinesses,
    loadingManaged,
    oauthScopesRequested,
    pendingConnect,
    productionPlaceId,
    connectingPlaceId,
    requestConnect,
    resolving,
    resolveDiagnostic,
    searchDiagnostic,
    searchResults,
    searching,
    selectBusiness,
    serverEnvKeyPresent,
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
