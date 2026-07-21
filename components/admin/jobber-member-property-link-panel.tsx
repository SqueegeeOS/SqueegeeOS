"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  advanceJobberPaginationCursor,
  appendUniqueJobberRecords,
  createJobberRequestGenerationGuard,
  hasCompleteJobberPropertyOwnershipEvidence,
  memberPropertyFilterChange,
} from "./jobber-member-property-link-state";

interface JobberClient {
  id: string;
  name: string;
  jobberWebUri: string;
}

interface JobberProperty {
  id: string;
  jobberWebUri: string;
}

interface MemberProperty {
  membershipId: string;
  propertyId: string;
  homeownerName: string;
  propertyLabel: string;
}

interface SearchResponse {
  clients?: JobberClient[];
  endCursor?: unknown;
  hasNextPage?: unknown;
  error?: string;
}

interface PropertiesResponse {
  properties?: JobberProperty[];
  endCursor?: unknown;
  hasNextPage?: unknown;
  ownershipProofPageLimit?: number;
  activeMemberProperties?: MemberProperty[];
  candidateLimitReached?: boolean;
  error?: string;
}

function normalized(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function JobberMemberPropertyLinkPanel() {
  const clientRequestGuard = useRef(createJobberRequestGenerationGuard()).current;
  const propertyRequestGuard = useRef(
    createJobberRequestGenerationGuard(),
  ).current;
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<JobberClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<JobberClient | null>(null);
  const [properties, setProperties] = useState<JobberProperty[]>([]);
  const [memberProperties, setMemberProperties] = useState<MemberProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [samePropertyConfirmed, setSamePropertyConfirmed] = useState(false);
  const [clientAfter, setClientAfter] = useState<string | null>(null);
  const [clientHasNextPage, setClientHasNextPage] = useState(false);
  const [clientSeenCursors, setClientSeenCursors] = useState<string[]>([]);
  const [propertyAfter, setPropertyAfter] = useState<string | null>(null);
  const [propertyHasNextPage, setPropertyHasNextPage] = useState(false);
  const [propertySeenCursors, setPropertySeenCursors] = useState<string[]>([]);
  const [propertyPagesLoaded, setPropertyPagesLoaded] = useState(0);
  const [ownershipProofPageLimit, setOwnershipProofPageLimit] = useState(0);
  const [candidateLimitReached, setCandidateLimitReached] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredMemberProperties = useMemo(() => {
    const filter = normalized(memberFilter);
    if (!filter) return memberProperties;
    return memberProperties.filter((candidate) =>
      normalized(`${candidate.homeownerName} ${candidate.propertyLabel}`).includes(
        filter,
      ),
    );
  }, [memberFilter, memberProperties]);

  const ownershipEvidenceComplete = hasCompleteJobberPropertyOwnershipEvidence({
    pagesLoaded: propertyPagesLoaded,
    hasNextPage: propertyHasNextPage,
    ownershipProofPageLimit,
  });

  const resetPropertyBrowsing = () => {
    propertyRequestGuard.invalidate();
    setLoadingProperties(false);
    setProperties([]);
    setMemberProperties([]);
    setSelectedPropertyId("");
    setSelectedMembershipId("");
    setMemberFilter("");
    setSamePropertyConfirmed(false);
    setPropertyAfter(null);
    setPropertyHasNextPage(false);
    setPropertySeenCursors([]);
    setPropertyPagesLoaded(0);
    setOwnershipProofPageLimit(0);
    setCandidateLimitReached(false);
  };

  const resetClientBrowsing = () => {
    clientRequestGuard.invalidate();
    setSearching(false);
    setClients([]);
    setClientAfter(null);
    setClientHasNextPage(false);
    setClientSeenCursors([]);
    setSelectedClient(null);
    resetPropertyBrowsing();
  };

  const loadClientPage = async (
    requestedAfter: string | null,
    append: boolean,
    seenCursors: readonly string[],
  ) => {
    const requestGeneration = clientRequestGuard.begin();
    setSearching(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/clients/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, after: requestedAfter }),
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => null)) as
        | SearchResponse
        | null;
      if (!clientRequestGuard.isCurrent(requestGeneration)) return;
      if (!response.ok || !body?.clients) {
        throw new Error(body?.error ?? "Could not search Jobber customers.");
      }
      const cursor = advanceJobberPaginationCursor({
        requestedAfter,
        endCursor: body.endCursor,
        hasNextPage: body.hasNextPage,
        seenCursors,
      });
      setClients((current) =>
        append
          ? appendUniqueJobberRecords(current, body.clients ?? [])
          : appendUniqueJobberRecords([], body.clients ?? []),
      );
      setClientAfter(cursor.after);
      setClientHasNextPage(cursor.hasNextPage);
      setClientSeenCursors([...cursor.seenCursors]);
    } catch (searchError) {
      if (!clientRequestGuard.isCurrent(requestGeneration)) return;
      if (!append) resetClientBrowsing();
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Could not search Jobber customers.",
      );
    } finally {
      if (clientRequestGuard.isCurrent(requestGeneration)) {
        setSearching(false);
      }
    }
  };

  const searchClients = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetClientBrowsing();
    await loadClientPage(null, false, []);
  };

  const loadPropertyPage = async (
    client: JobberClient,
    requestedAfter: string | null,
    append: boolean,
    seenCursors: readonly string[],
    pagesLoaded: number,
  ) => {
    const requestGeneration = propertyRequestGuard.begin();
    setLoadingProperties(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/clients/properties",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id, after: requestedAfter }),
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => null)) as
        | PropertiesResponse
        | null;
      if (!propertyRequestGuard.isCurrent(requestGeneration)) return;
      if (
        !response.ok ||
        !body?.properties ||
        !body.activeMemberProperties ||
        !Number.isInteger(body.ownershipProofPageLimit) ||
        (body.ownershipProofPageLimit ?? 0) < 1
      ) {
        throw new Error(body?.error ?? "Could not load Jobber properties.");
      }
      const cursor = advanceJobberPaginationCursor({
        requestedAfter,
        endCursor: body.endCursor,
        hasNextPage: body.hasNextPage,
        seenCursors,
      });
      setProperties((current) =>
        append
          ? appendUniqueJobberRecords(current, body.properties ?? [])
          : appendUniqueJobberRecords([], body.properties ?? []),
      );
      if (!append) setMemberProperties(body.activeMemberProperties);
      setPropertyAfter(cursor.after);
      setPropertyHasNextPage(cursor.hasNextPage);
      setPropertySeenCursors([...cursor.seenCursors]);
      setPropertyPagesLoaded(pagesLoaded + 1);
      setOwnershipProofPageLimit(body.ownershipProofPageLimit ?? 0);
      setCandidateLimitReached(body.candidateLimitReached === true);
    } catch (propertiesError) {
      if (!propertyRequestGuard.isCurrent(requestGeneration)) return;
      setError(
        propertiesError instanceof Error
          ? propertiesError.message
          : "Could not load Jobber properties.",
      );
    } finally {
      if (propertyRequestGuard.isCurrent(requestGeneration)) {
        setLoadingProperties(false);
      }
    }
  };

  const selectClient = async (client: JobberClient) => {
    setSelectedClient(client);
    resetPropertyBrowsing();
    await loadPropertyPage(client, null, false, [], 0);
  };

  const confirmLink = async () => {
    if (!selectedClient || !selectedPropertyId || !selectedMembershipId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/property-links",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "link_client_property",
            clientId: selectedClient.id,
            externalPropertyId: selectedPropertyId,
            membershipId: selectedMembershipId,
            samePhysicalPropertyConfirmed: samePropertyConfirmed,
          }),
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { outcome?: string; error?: string }
        | null;
      if (!response.ok || !body?.outcome) {
        throw new Error(body?.error ?? "The property link was not changed.");
      }
      setSuccess(
        body.outcome === "already_linked"
          ? "This exact property identity was already linked."
          : "Member property identity linked.",
      );
      setSamePropertyConfirmed(false);
      window.dispatchEvent(new Event("jobber-property-link-changed"));
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "The property link was not changed.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 border-t border-border/70 pt-7">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
        Member property identity
      </p>
      <h3 className="mt-2 font-serif text-xl font-light text-foreground">
        Find a Jobber customer
      </h3>
      <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
        Link one exact Jobber property to one active HomeAtlas member property.
        This links property identity only; every visit still requires individual
        approval.
      </p>

      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={searchClients}>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search Jobber customers by name</span>
          <input
            type="search"
            value={query}
            minLength={2}
            maxLength={100}
            required
            onChange={(event) => {
              setQuery(event.target.value);
              resetClientBrowsing();
              setError(null);
              setSuccess(null);
            }}
            placeholder="Customer name"
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted/70"
          />
        </label>
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-40"
        >
          {searching ? "Searching…" : "Search Jobber"}
        </button>
      </form>

      <div aria-live="polite">
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {success ? (
          <p className="mt-4 text-sm text-emerald-300">{success}</p>
        ) : null}
      </div>
      {clients.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {clients.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                aria-pressed={selectedClient?.id === client.id}
                onClick={() => void selectClient(client)}
                className="w-full rounded-xl border border-border/70 px-4 py-3 text-left text-sm text-foreground transition hover:border-accent/40 aria-pressed:border-accent/50 aria-pressed:bg-accent/[0.06]"
              >
                {client.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {clientHasNextPage ? (
        <button
          type="button"
          onClick={() =>
            void loadClientPage(clientAfter, true, clientSeenCursors)
          }
          disabled={searching || !clientAfter}
          className="mt-4 rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-40"
        >
          {searching ? "Loading customers…" : "Search next 100 Jobber customers"}
        </button>
      ) : null}

      {selectedClient ? (
        <div className="mt-6 rounded-2xl border border-border/70 p-4 sm:p-5">
          <p className="text-sm text-foreground">{selectedClient.name}</p>
          {loadingProperties && properties.length === 0 ? (
            <p className="mt-3 text-xs text-muted">Loading exact properties…</p>
          ) : properties.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              No properties were returned for this Jobber customer.
            </p>
          ) : (
            <fieldset className="mt-4">
              <legend className="text-[10px] uppercase tracking-[0.14em] text-muted">
                Exact Jobber property
              </legend>
              <div className="mt-2 space-y-2">
                {properties.map((property, index) => (
                  <label
                    key={property.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"
                  >
                    <span className="flex items-center gap-3 text-sm text-foreground">
                      <input
                        type="radio"
                        name="jobber-property"
                        value={property.id}
                        checked={selectedPropertyId === property.id}
                        onChange={() => {
                          setSelectedPropertyId(property.id);
                          setSamePropertyConfirmed(false);
                          setSuccess(null);
                        }}
                        className="size-4 accent-[var(--accent)]"
                      />
                      Property {index + 1}
                    </span>
                    <a
                      href={property.jobberWebUri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent underline decoration-accent/30 underline-offset-4"
                    >
                      Open property in Jobber ↗
                    </a>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {propertyHasNextPage ? (
            <button
              type="button"
              onClick={() =>
                void loadPropertyPage(
                  selectedClient,
                  propertyAfter,
                  true,
                  propertySeenCursors,
                  propertyPagesLoaded,
                )
              }
              disabled={loadingProperties || !propertyAfter}
              className="mt-4 rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-40"
            >
              {loadingProperties ? "Loading properties…" : "Load more properties"}
            </button>
          ) : null}
          {propertyPagesLoaded > 0 && !ownershipEvidenceComplete ? (
            <p className="mt-4 text-xs text-amber-300">
              {propertyHasNextPage
                ? "Load every Jobber property page before confirming a link."
                : "The current ownership proof cannot cover this many Jobber properties, so linking remains unavailable."}
            </p>
          ) : null}
          {candidateLimitReached ? (
            <p className="mt-4 text-xs text-amber-300">
              The active-member list reached its supervised review bound. Stop
              before linking because the list may be incomplete.
            </p>
          ) : null}

          {selectedPropertyId && memberProperties.length > 0 ? (
            <div className="mt-5 space-y-4 border-t border-border/70 pt-5">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Filter active member properties
                </span>
                <input
                  type="search"
                  value={memberFilter}
                  onChange={(event) => {
                    const next = memberPropertyFilterChange(
                      event.target.value,
                    );
                    setMemberFilter(next.memberFilter);
                    setSelectedMembershipId(next.selectedMembershipId);
                    setSamePropertyConfirmed(next.samePropertyConfirmed);
                    setSuccess(null);
                  }}
                  placeholder="Homeowner or address"
                  autoComplete="off"
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted/70"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Active HomeAtlas member property
                </span>
                <select
                  value={selectedMembershipId}
                  onChange={(event) => {
                    setSelectedMembershipId(event.target.value);
                    setSamePropertyConfirmed(false);
                    setSuccess(null);
                  }}
                  disabled={candidateLimitReached}
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
                >
                  <option value="">Choose a member property…</option>
                  {filteredMemberProperties.map((candidate) => (
                    <option
                      key={candidate.membershipId}
                      value={candidate.membershipId}
                    >
                      {candidate.homeownerName} — {candidate.propertyLabel}
                    </option>
                  ))}
                </select>
              </label>
              {filteredMemberProperties.length === 0 ? (
                <p className="text-xs text-muted">
                  No active member property matches this filter.
                </p>
              ) : null}
              <label className="flex items-start gap-3 text-xs leading-relaxed text-muted">
                <input
                  type="checkbox"
                  checked={samePropertyConfirmed}
                  onChange={(event) =>
                    setSamePropertyConfirmed(event.target.checked)
                  }
                  disabled={
                    !selectedMembershipId ||
                    candidateLimitReached ||
                    !ownershipEvidenceComplete ||
                    saving
                  }
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                I opened the Jobber property and confirmed it is the same
                physical address as the selected HomeAtlas property.
              </label>
              <button
                type="button"
                onClick={() => void confirmLink()}
                disabled={
                  candidateLimitReached ||
                  !ownershipEvidenceComplete ||
                  !selectedMembershipId ||
                  !samePropertyConfirmed ||
                  saving
                }
                className="rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-40"
              >
                {saving ? "Linking…" : "Confirm member property"}
              </button>
            </div>
          ) : selectedPropertyId && !loadingProperties ? (
            <p className="mt-5 text-xs leading-relaxed text-muted">
              There are no strictly active HomeAtlas member properties
              available. This property remains Jobber-only.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
