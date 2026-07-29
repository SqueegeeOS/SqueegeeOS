"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";

interface HomeAtlasCustomerCandidate {
  homeownerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  properties: Array<{ propertyId: string; label: string }>;
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
  }>;
  propertyCount: number;
  propertiesComplete: boolean;
  customerLink: CustomerLinkPreview | null;
}

interface CustomerWorkspace {
  executionMode: "supervised_customer_pairing";
  automaticMatching: false;
  billingEnabled: false;
  clients: JobberClientPreview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
}

interface MatchResponse {
  outcome?: string;
  workspace?: CustomerWorkspace;
  error?: string;
}

async function requestCustomerWorkspace(
  search: string,
  page: number,
): Promise<CustomerWorkspace> {
  const params = new URLSearchParams({
    search,
    page: String(page),
    pageSize: "20",
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await requestCustomerWorkspace(search, page));
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
    requestCustomerWorkspace("", 1)
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
    void load(nextQuery, 1);
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
    if (action === "link" && !homeownerId) return;
    if (
      action === "revoke" &&
      !window.confirm(
        "Remove this customer pairing? No Jobber or HomeAtlas customer data will be deleted.",
      )
    ) {
      return;
    }

    setSavingClientId(client.externalClientId);
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
            expectedLinkUpdatedAt: client.customerLink?.updatedAt ?? null,
            search: workspace?.search ?? "",
            page: workspace?.page ?? 1,
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
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "The customer pairing was not changed",
      );
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
          Search the complete synchronized Jobber customer list, then search
          HomeAtlas and confirm the same household. Pairing connects identity
          only; it does not change Jobber, create a membership, or enable
          billing.
        </p>
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
            const searchResult = homeAtlasResults[client.externalClientId];
            const selected =
              selectedHomeowners[client.externalClientId] ?? "";
            const selectedCustomer = searchResult?.customers.find(
              (candidate) => candidate.homeownerId === selected,
            );
            const confirmed =
              confirmations[client.externalClientId] === true;

            return (
              <article
                key={client.externalClientId}
                className="rounded-2xl border border-border/70 bg-foreground/[0.025] p-4"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{client.name}</p>
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
                            <div className="rounded-xl bg-foreground/[0.035] p-3 text-xs leading-relaxed text-muted">
                              <p className="text-foreground">
                                {selectedCustomer.fullName}
                              </p>
                              <p>
                                {[selectedCustomer.email, selectedCustomer.phone]
                                  .filter(Boolean)
                                  .join(" - ") || "No email or phone"}
                              </p>
                              {selectedCustomer.properties.map((property) => (
                                <p key={property.propertyId}>{property.label}</p>
                              ))}
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
                            in Jobber and HomeAtlas.
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
            onClick={() => void load(workspace.search, workspace.page - 1)}
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
            onClick={() => void load(workspace.search, workspace.page + 1)}
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
