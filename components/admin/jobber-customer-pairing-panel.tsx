"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";

interface HomeAtlasCustomerCandidate {
  homeownerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  properties: Array<{
    propertyId: string;
    label: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }>;
}

interface HomeAtlasSearchResponse {
  customers: HomeAtlasCustomerCandidate[];
  search: string;
  limitReached: boolean;
  error?: string;
}

interface CustomerLinkPreview {
  linkId: string;
  homeownerId: string;
  homeownerName: string;
  linkState: "active" | "revoked";
  updatedAt: string;
}

interface JobberClientPreview {
  projectionId: string;
  externalClientId: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  jobberWebUri: string;
  isArchived: boolean;
  properties: Array<{
    id: string;
    name: string | null;
    jobberWebUri: string;
    address: Record<string, string | null> | null;
  }>;
  propertyCount: number;
  propertiesComplete: boolean;
  sourcePayloadHash: string;
  reviewOutcome:
    | "link"
    | "already_linked"
    | "manual_review"
    | "insufficient_evidence"
    | "conflict"
    | "revocation_respected"
    | "archived";
  reviewReason: string;
  suggestedCustomer: HomeAtlasCustomerCandidate | null;
  customerLink: CustomerLinkPreview | null;
}

type CustomerQueue = "review" | "unpaired" | "paired" | "all";

interface CustomerWorkspace {
  executionMode: "supervised_customer_pairing";
  automaticMatching: "strict_exact_only";
  billingEnabled: false;
  clients: JobberClientPreview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
  queue: CustomerQueue;
  queueCounts: Record<CustomerQueue, number>;
}

interface MatchResponse {
  outcome?: string;
  workspace?: CustomerWorkspace;
  error?: string;
}

interface PairingStatus {
  tone: "pending" | "success" | "error";
  message: string;
}

async function requestCustomerWorkspace(
  search: string,
  page: number,
  queue: CustomerQueue,
): Promise<CustomerWorkspace> {
  const params = new URLSearchParams({
    search,
    page: String(page),
    pageSize: "20",
    queue,
  });
  const response = await fetch(
    `/api/admin/care-operations/jobber/customers?${params.toString()}`,
    { headers: getAdminRequestHeaders(), cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | (CustomerWorkspace & { error?: string })
    | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? "Could not load Jobber customers");
  }
  return body;
}

function normalizeEvidence(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizePhoneEvidence(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
}

const STREET_SUFFIXES: Record<string, string> = {
  avenue: "ave",
  boulevard: "blvd",
  circle: "cir",
  court: "ct",
  drive: "dr",
  highway: "hwy",
  lane: "ln",
  parkway: "pkwy",
  place: "pl",
  road: "rd",
  street: "st",
  terrace: "ter",
  trail: "trl",
  way: "way",
};

function normalizeStreetEvidence(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => STREET_SUFFIXES[word] ?? word)
    .join(" ");
}

function jobberAddressEvidenceKey(
  address: Record<string, string | null> | null,
): string | null {
  if (!address) return null;
  const first = (...keys: string[]) =>
    keys.map((key) => address[key]).find((value) => value?.trim())?.trim() ?? "";
  const street1 = first(
    "street",
    "streetAddress",
    "street1",
    "streetOne",
    "address1",
    "line1",
  );
  const street2 =
    street1 === address.street
      ? ""
      : first("street2", "streetTwo", "address2", "line2");
  const city = normalizeEvidence(first("city"));
  const state = normalizeEvidence(
    first("province", "provinceCode", "state", "stateCode"),
  ).replace("california", "ca");
  const zip = first("postalCode", "zipCode").replace(/\D/g, "").slice(0, 5);
  const street = normalizeStreetEvidence([street1, street2].filter(Boolean).join(" "));
  return street && city && state && zip
    ? `${street}|${city}|${state}|${zip}`
    : null;
}

function homeAtlasAddressEvidenceKey(
  property: HomeAtlasCustomerCandidate["properties"][number],
): string | null {
  const street = normalizeStreetEvidence(property.address);
  const city = normalizeEvidence(property.city);
  const state = normalizeEvidence(property.state).replace("california", "ca");
  const zip = property.zip.replace(/\D/g, "").slice(0, 5);
  return street && city && state && zip
    ? `${street}|${city}|${state}|${zip}`
    : null;
}

function jobberAddressLabel(
  address: Record<string, string | null> | null,
): string {
  if (!address) return "Not available";
  const first = (...keys: string[]) =>
    keys.map((key) => address[key]).find((value) => value?.trim())?.trim() ?? "";
  return [
    first("street", "streetAddress", "street1", "streetOne", "address1", "line1"),
    first("street2", "streetTwo", "address2", "line2"),
    first("city"),
    first("province", "provinceCode", "state", "stateCode"),
    first("postalCode", "zipCode"),
  ]
    .filter(Boolean)
    .join(", ") || "Not available";
}

function evidenceState(
  source: string | null | undefined,
  targets: Array<string | null | undefined>,
  normalizer = normalizeEvidence,
): "exact" | "different" | "missing" {
  const normalizedSource = normalizer(source);
  const normalizedTargets = targets.map(normalizer).filter(Boolean);
  if (!normalizedSource || normalizedTargets.length === 0) return "missing";
  return normalizedTargets.includes(normalizedSource) ? "exact" : "different";
}

function EvidenceRow({
  label,
  jobber,
  homeAtlas,
  state,
}: {
  label: string;
  jobber: string;
  homeAtlas: string;
  state: "exact" | "different" | "missing";
}) {
  const badge =
    state === "exact"
      ? "Exact"
      : state === "different"
        ? "Different"
        : "Missing";
  return (
    <div className="grid gap-2 border-t border-border/60 py-3 first:border-t-0 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-center">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="break-words text-xs text-foreground">{jobber}</p>
      <p className="break-words text-xs text-foreground">{homeAtlas}</p>
      <span
        className={`w-fit rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
          state === "exact"
            ? "border-emerald-500/30 text-emerald-300"
            : state === "different"
              ? "border-amber-500/30 text-amber-300"
              : "border-border text-muted"
        }`}
      >
        {badge}
      </span>
    </div>
  );
}

async function requestHomeAtlasCustomers(
  search: string,
): Promise<HomeAtlasSearchResponse> {
  const params = new URLSearchParams({ search, limit: "30" });
  const response = await fetch(
    `/api/admin/care-operations/jobber/homeatlas-customers?${params.toString()}`,
    { headers: getAdminRequestHeaders(), cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | HomeAtlasSearchResponse
    | null;
  if (!response.ok || !body?.customers) {
    throw new Error(body?.error ?? "Could not search HomeAtlas customers");
  }
  return body;
}

export function JobberCustomerPairingPanel() {
  const [workspace, setWorkspace] = useState<CustomerWorkspace | null>(null);
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<CustomerQueue>("review");
  const [homeAtlasQueries, setHomeAtlasQueries] = useState<
    Record<string, string>
  >({});
  const [homeAtlasResults, setHomeAtlasResults] = useState<
    Record<string, HomeAtlasSearchResponse>
  >({});
  const [selectedHomeowners, setSelectedHomeowners] = useState<
    Record<string, string>
  >({});
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [searchingHomeAtlasClientId, setSearchingHomeAtlasClientId] = useState<
    string | null
  >(null);
  const [savingClientId, setSavingClientId] = useState<string | null>(null);
  const [pairingStatuses, setPairingStatuses] = useState<
    Record<string, PairingStatus>
  >({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (
    search: string,
    page: number,
    nextQueue: CustomerQueue,
  ) => {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await requestCustomerWorkspace(search, page, nextQueue));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Jobber customers",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestCustomerWorkspace("", 1, "review")
      .then((result) => {
        if (!cancelled) setWorkspace(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load Jobber customers",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = query.trim();
    void load(nextQuery, 1, queue);
  };

  const changeQueue = (nextQueue: CustomerQueue) => {
    setQueue(nextQueue);
    void load(query.trim(), 1, nextQueue);
  };

  const searchHomeAtlas = async (
    event: FormEvent<HTMLFormElement>,
    client: JobberClientPreview,
  ) => {
    event.preventDefault();
    setSearchingHomeAtlasClientId(client.externalClientId);
    setError(null);
    try {
      const result = await requestHomeAtlasCustomers(
        homeAtlasQueries[client.externalClientId]?.trim() ?? "",
      );
      setHomeAtlasResults((current) => ({
        ...current,
        [client.externalClientId]: result,
      }));
      setSelectedHomeowners((current) => ({
        ...current,
        [client.externalClientId]: "",
      }));
      setConfirmations((current) => ({
        ...current,
        [client.externalClientId]: false,
      }));
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Could not search HomeAtlas customers",
      );
    } finally {
      setSearchingHomeAtlasClientId(null);
    }
  };

  const writeLink = async (
    client: JobberClientPreview,
    action: "link" | "revoke",
  ) => {
    const homeownerId = selectedHomeowners[client.externalClientId];
    if (action === "link" && !homeownerId) {
      setPairingStatuses((current) => ({
        ...current,
        [client.externalClientId]: {
          tone: "error",
          message: "Choose the matching HomeAtlas customer before pairing.",
        },
      }));
      return;
    }
    const selectedCandidate =
      homeAtlasResults[client.externalClientId]?.customers.find(
        (candidate) => candidate.homeownerId === homeownerId,
      ) ??
      (client.suggestedCustomer?.homeownerId === homeownerId
        ? client.suggestedCustomer
        : null);
    if (action === "link" && !selectedCandidate) {
      setPairingStatuses((current) => ({
        ...current,
        [client.externalClientId]: {
          tone: "error",
          message:
            "That HomeAtlas selection is no longer available. Search and select it again.",
        },
      }));
      return;
    }
    if (
      action === "revoke" &&
      !window.confirm(
        "Remove this customer pairing? No Jobber or HomeAtlas customer data will be deleted.",
      )
    ) {
      return;
    }

    setSavingClientId(client.externalClientId);
    setPairingStatuses((current) => ({
      ...current,
      [client.externalClientId]: {
        tone: "pending",
        message:
          action === "link"
            ? `Pairing ${client.name} with ${selectedCandidate?.fullName ?? "the selected HomeAtlas customer"}...`
            : `Removing ${client.name}'s customer pairing...`,
      },
    }));
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/care-operations/jobber/customers",
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            action,
            externalClientId: client.externalClientId,
            homeownerId: action === "link" ? homeownerId : undefined,
            sameCustomerConfirmed:
              action === "link"
                ? confirmations[client.externalClientId] === true
                : undefined,
            expectedSourcePayloadHash:
              action === "link" ? client.sourcePayloadHash : undefined,
            expectedLinkUpdatedAt: client.customerLink?.updatedAt ?? null,
            search: workspace?.search ?? "",
            page: workspace?.page ?? 1,
            queue: workspace?.queue ?? queue,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | MatchResponse
        | null;
      if (!response.ok || !body?.workspace) {
        throw new Error(body?.error ?? "The customer pairing was not changed");
      }
      setWorkspace(body.workspace);
      setSelectedHomeowners((current) => ({
        ...current,
        [client.externalClientId]: "",
      }));
      setConfirmations((current) => ({
        ...current,
        [client.externalClientId]: false,
      }));
      setPairingStatuses((current) => ({
        ...current,
        [client.externalClientId]: {
          tone: "success",
          message:
            action === "link"
              ? `${client.name} is now paired with ${selectedCandidate?.fullName ?? "the selected HomeAtlas customer"}.`
              : `${client.name}'s customer pairing was removed.`,
        },
      }));
    } catch (writeError) {
      setPairingStatuses((current) => ({
        ...current,
        [client.externalClientId]: {
          tone: "error",
          message:
            writeError instanceof Error
              ? writeError.message
              : "The customer pairing was not changed",
        },
      }));
    } finally {
      setSavingClientId(null);
    }
  };

  return (
    <div className="mt-8 border-t border-border/70 pt-7">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
          Customer identity
        </p>
        <h3 className="mt-2 font-serif text-xl font-light text-foreground">
          Pair Jobber customers with HomeAtlas
        </h3>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
          HomeAtlas safely pairs only a unique exact property address plus an
          exact, non-conflicting email or phone. Anything incomplete,
          ambiguous, previously revoked, or conflicting stays here for human
          review. Pairing connects identity only; it never changes Jobber,
          creates a membership, or enables billing.
        </p>
        <div className="mt-4 grid gap-2 text-[11px] leading-relaxed text-muted sm:grid-cols-3">
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            Exact evidence only
          </p>
          <p className="rounded-xl border border-border/70 bg-foreground/[0.025] p-3">
            Conflicts require you
          </p>
          <p className="rounded-xl border border-border/70 bg-foreground/[0.025] p-3">
            Audited and reversible
          </p>
        </div>
      </div>

      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Customer pairing queues"
      >
        {(
          [
            ["review", "Needs review"],
            ["unpaired", "Needs info"],
            ["paired", "Paired"],
            ["all", "All"],
          ] as Array<[CustomerQueue, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => changeQueue(value)}
            disabled={loading}
            aria-pressed={queue === value}
            className={`rounded-full border px-4 py-2 text-xs transition disabled:opacity-50 ${
              queue === value
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {label} {workspace?.queueCounts[value]?.toLocaleString() ?? "-"}
          </button>
        ))}
      </div>

      <form
        onSubmit={submitSearch}
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        role="search"
      >
        <label className="sr-only" htmlFor="jobber-customer-search">
          Search Jobber customers
        </label>
        <input
          id="jobber-customer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, company, email, phone, or property"
          className="min-h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-full border border-accent/40 bg-accent/10 px-5 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-50"
        >
          Search Jobber
        </button>
      </form>

      {workspace ? (
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          {workspace.total.toLocaleString()} Jobber customer
          {workspace.total === 1 ? "" : "s"}
          {workspace.search ? ` matching "${workspace.search}"` : ""}
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {workspace?.clients.length ? (
        <div className="mt-5 space-y-3">
          {workspace.clients.map((client) => {
            const pairing = client.customerLink;
            const saving = savingClientId === client.externalClientId;
            const searchingHomeAtlas =
              searchingHomeAtlasClientId === client.externalClientId;
            const searchedResult = homeAtlasResults[client.externalClientId];
            const suggestedCustomer = client.suggestedCustomer;
            const searchResult =
              searchedResult ??
              (suggestedCustomer
                ? {
                    customers: [suggestedCustomer],
                    search: "",
                    limitReached: false,
                  }
                : undefined);
            const selected =
              selectedHomeowners[client.externalClientId] ?? "";
            const selectedCustomer = searchResult?.customers.find(
              (candidate) => candidate.homeownerId === selected,
            );
            const confirmed =
              confirmations[client.externalClientId] === true;
            const pairingStatus = pairingStatuses[client.externalClientId];
            const jobberAddress = jobberAddressLabel(
              client.properties[0]?.address ?? null,
            );
            const homeAtlasAddresses =
              selectedCustomer?.properties.map((property) =>
                [property.address, property.city, property.state, property.zip]
                  .filter(Boolean)
                  .join(", "),
              ) ?? [];
            const emailState = evidenceState(
              client.email,
              [selectedCustomer?.email],
            );
            const phoneState = evidenceState(
              client.phone,
              [selectedCustomer?.phone],
              normalizePhoneEvidence,
            );
            const addressState = evidenceState(
              jobberAddressEvidenceKey(client.properties[0]?.address ?? null),
              selectedCustomer?.properties.map(homeAtlasAddressEvidenceKey) ?? [],
            );

            return (
              <article
                key={client.externalClientId}
                className="rounded-2xl border border-border/70 bg-foreground/[0.025] p-4"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{client.name}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          client.reviewOutcome === "conflict"
                            ? "border-red-500/30 text-red-300"
                            : client.reviewOutcome === "manual_review"
                              ? "border-amber-500/30 text-amber-300"
                              : client.reviewOutcome === "already_linked"
                                ? "border-emerald-500/30 text-emerald-300"
                                : "border-border text-muted"
                        }`}
                      >
                        {client.reviewOutcome.replaceAll("_", " ")}
                      </span>
                      {client.isArchived ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                          Archived
                        </span>
                      ) : null}
                    </div>
                    {client.companyName ? (
                      <p className="mt-1 text-xs text-muted">
                        {client.companyName}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      {[client.email, client.phone].filter(Boolean).join(" - ") ||
                        "No email or phone in Jobber"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {client.propertyCount} propert
                      {client.propertyCount === 1 ? "y" : "ies"}
                      {!client.propertiesComplete ? " - first 25 shown" : ""}
                    </p>
                    <p className="mt-2 max-w-xl text-xs leading-relaxed text-amber-200/80">
                      {client.reviewReason}
                    </p>
                    {client.properties.length ? (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {client.properties.slice(0, 3).map((property) => (
                          <a
                            key={property.id}
                            href={property.jobberWebUri}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-accent underline decoration-accent/30 underline-offset-4"
                          >
                            {property.name || "Jobber property"}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <a
                    href={client.jobberWebUri}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-accent underline decoration-accent/30 underline-offset-4"
                  >
                    Open in Jobber
                  </a>
                </div>

                {pairing?.linkState === "active" ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                        Paired HomeAtlas customer
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {pairing.homeownerName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void writeLink(client, "revoke")}
                      disabled={savingClientId !== null}
                      className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:text-foreground disabled:opacity-50"
                    >
                      {saving ? "Removing..." : "Remove pairing"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 rounded-xl border border-border/70 p-4">
                    {suggestedCustomer && !searchedResult ? (
                      <div className="flex flex-col gap-3 rounded-xl border border-accent/25 bg-accent/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-accent">
                            Evidence-based suggestion
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {suggestedCustomer.fullName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedHomeowners((current) => ({
                              ...current,
                              [client.externalClientId]:
                                suggestedCustomer.homeownerId,
                            }))
                          }
                          disabled={savingClientId !== null}
                          className="rounded-full border border-accent/40 px-4 py-2 text-xs text-accent disabled:opacity-50"
                        >
                          Compare records
                        </button>
                      </div>
                    ) : null}
                    <form
                      onSubmit={(event) => void searchHomeAtlas(event, client)}
                      className="flex flex-col gap-2 sm:flex-row"
                    >
                      <label className="flex-1">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                          Search HomeAtlas
                        </span>
                        <input
                          type="search"
                          value={
                            homeAtlasQueries[client.externalClientId] ?? ""
                          }
                          onChange={(event) =>
                            setHomeAtlasQueries((current) => ({
                              ...current,
                              [client.externalClientId]: event.target.value,
                            }))
                          }
                          placeholder="Name, email, phone, or address"
                          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/50"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={
                          searchingHomeAtlas || savingClientId !== null
                        }
                        className="self-end rounded-full border border-border px-4 py-3 text-xs text-muted transition hover:text-foreground disabled:opacity-50"
                      >
                        {searchingHomeAtlas ? "Searching..." : "Find matches"}
                      </button>
                    </form>

                    {searchResult ? (
                      searchResult.customers.length ? (
                        <>
                          <label className="block">
                            <span className="sr-only">
                              Choose HomeAtlas customer
                            </span>
                            <select
                              value={selected}
                              onChange={(event) =>
                                setSelectedHomeowners((current) => ({
                                  ...current,
                                  [client.externalClientId]: event.target.value,
                                }))
                              }
                              disabled={savingClientId !== null}
                              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
                            >
                              <option value="">
                                Choose a HomeAtlas customer...
                              </option>
                              {searchResult.customers.map((candidate) => (
                                <option
                                  key={candidate.homeownerId}
                                  value={candidate.homeownerId}
                                >
                                  {candidate.fullName}
                                  {candidate.email
                                    ? ` - ${candidate.email}`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          {searchResult.limitReached ? (
                            <p className="text-xs text-amber-400">
                              More matches exist. Add another name, email,
                              phone digit, or address detail to narrow the list.
                            </p>
                          ) : null}
                          {selectedCustomer ? (
                            <div className="rounded-xl border border-border/70 bg-foreground/[0.035] p-3 text-xs leading-relaxed text-muted">
                              <div className="grid gap-1 pb-2 sm:grid-cols-[6rem_1fr_1fr_auto]">
                                <span />
                                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                                  Jobber
                                </p>
                                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                                  HomeAtlas
                                </p>
                                <span />
                              </div>
                              <EvidenceRow
                                label="Customer"
                                jobber={client.name}
                                homeAtlas={selectedCustomer.fullName}
                                state={evidenceState(client.name, [selectedCustomer.fullName])}
                              />
                              <EvidenceRow
                                label="Email"
                                jobber={client.email || "Not available"}
                                homeAtlas={selectedCustomer.email || "Not available"}
                                state={emailState}
                              />
                              <EvidenceRow
                                label="Phone"
                                jobber={client.phone || "Not available"}
                                homeAtlas={selectedCustomer.phone || "Not available"}
                                state={phoneState}
                              />
                              <EvidenceRow
                                label="Property"
                                jobber={jobberAddress}
                                homeAtlas={homeAtlasAddresses.join(" / ") || "Not available"}
                                state={addressState}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedHomeowners((current) => ({
                                    ...current,
                                    [client.externalClientId]: "",
                                  }));
                                  setConfirmations((current) => ({
                                    ...current,
                                    [client.externalClientId]: false,
                                  }));
                                }}
                                className="mt-2 text-xs text-muted underline decoration-border underline-offset-4 hover:text-foreground"
                              >
                                Not the same customer - clear selection
                              </button>
                            </div>
                          ) : null}
                          <label className="flex items-start gap-3 text-xs leading-relaxed text-muted">
                            <input
                              type="checkbox"
                              checked={confirmed}
                              onChange={(event) =>
                                setConfirmations((current) => ({
                                  ...current,
                                  [client.externalClientId]: event.target.checked,
                                }))
                              }
                              disabled={savingClientId !== null}
                              className="mt-0.5 size-4 accent-[var(--accent)]"
                            />
                            I verified this is the same customer or household
                            in Jobber and HomeAtlas. Pairing links identity only
                            and cannot enable billing.
                          </label>
                          <button
                            type="button"
                            onClick={() => void writeLink(client, "link")}
                            disabled={
                              !selected ||
                              !confirmed ||
                              client.isArchived ||
                              savingClientId !== null
                            }
                            className="rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-accent transition hover:bg-accent/15 disabled:opacity-40"
                          >
                            {saving ? "Pairing..." : "Pair customer"}
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-muted">
                          No HomeAtlas customers match this search.
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-muted">
                        Search HomeAtlas to choose the matching customer.
                      </p>
                    )}
                  </div>
                )}
                {pairingStatus ? (
                  <p
                    className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                      pairingStatus.tone === "success"
                        ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200"
                        : pairingStatus.tone === "error"
                          ? "border-red-500/25 bg-red-500/[0.07] text-red-300"
                          : "border-accent/25 bg-accent/[0.06] text-accent"
                    }`}
                    role={pairingStatus.tone === "error" ? "alert" : "status"}
                    aria-live="polite"
                  >
                    {pairingStatus.message}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : loading ? (
        <p className="mt-5 text-xs text-muted">Loading Jobber customers...</p>
      ) : (
        <p className="mt-5 text-xs text-muted">
          {workspace?.search
            ? "No Jobber customers match this search."
            : "No Jobber customers have been synchronized yet."}
        </p>
      )}

      {workspace && workspace.totalPages > 1 ? (
        <nav
          className="mt-5 flex items-center justify-between gap-4"
          aria-label="Jobber customer pages"
        >
          <button
            type="button"
            onClick={() =>
              void load(workspace.search, workspace.page - 1, workspace.queue)
            }
            disabled={loading || workspace.page <= 1}
            className="rounded-full border border-border px-4 py-2 text-xs text-muted disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted">
            Page {workspace.page} of {workspace.totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              void load(workspace.search, workspace.page + 1, workspace.queue)
            }
            disabled={loading || workspace.page >= workspace.totalPages}
            className="rounded-full border border-border px-4 py-2 text-xs text-muted disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
