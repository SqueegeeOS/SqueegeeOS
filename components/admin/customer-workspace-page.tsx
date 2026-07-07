"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  schedulePresentationFromLead,
  updateLeadIntakeStatusClient,
} from "@/lib/acquisition/leads/inbox-client";
import { formatLeadIntakeStatus } from "@/lib/acquisition/leads/inbox";
import { craftEyebrow, craftFieldLabel, craftInput, craftTextarea } from "@/lib/craft/tokens";
import type { CustomerWorkspace, CustomerWorkspaceRefType } from "@/lib/hq/customer-workspace/types";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";
import { ROUTES } from "@/lib/navigation/config";
import { formatTierPrice } from "@/lib/membership/tier-config";

function Section({
  title,
  children,
  index = 0,
  rim = false,
}: {
  title: string;
  children: React.ReactNode;
  index?: number;
  rim?: boolean;
}) {
  return (
    <GlassCard as="section" tone="subtle" motion="rise" index={index} rim={rim}>
      <h2 className={craftEyebrow}>{title}</h2>
      <div className="mt-5 space-y-4 text-sm leading-relaxed">{children}</div>
    </GlassCard>
  );
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div>
      <p className={craftFieldLabel}>{label}</p>
      {href && value ? (
        <a href={href} className="mt-1 block text-foreground hover:text-accent">
          {value}
        </a>
      ) : (
        <p className="mt-1 text-foreground">{value?.trim() ? value : "—"}</p>
      )}
    </div>
  );
}

export function CustomerWorkspacePage({
  type,
  id,
}: {
  type: CustomerWorkspaceRefType;
  id: string;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<CustomerWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    squareFeet: "",
    notes: "",
  });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/customer-workspace/${type}/${id}`,
        { headers: getAdminRequestHeaders(), cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Customer not found" : "Failed to load");
      }
      const data = (await response.json()) as { workspace: CustomerWorkspace };
      setWorkspace(data.workspace);
      setDraft({
        name: data.workspace.contact.name,
        email: data.workspace.contact.email ?? "",
        phone: data.workspace.contact.phone ?? "",
        address: data.workspace.property?.address ?? data.workspace.lead?.serviceAddress ?? "",
        city: data.workspace.property?.city ?? "",
        state: data.workspace.property?.state ?? "",
        zip: data.workspace.property?.zip ?? "",
        squareFeet:
          data.workspace.property?.squareFeet?.toString() ??
          data.workspace.lead?.squareFootage?.toString() ??
          "",
        notes: data.workspace.notes,
      });

      if (
        data.workspace.canonical &&
        (data.workspace.canonical.type !== type ||
          data.workspace.canonical.id !== id)
      ) {
        router.replace(
          customerWorkspaceHref(
            data.workspace.canonical.type,
            data.workspace.canonical.id,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [id, router, type]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const saveWorkspace = async () => {
    if (!workspace) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        notes: draft.notes,
      };

      if (workspace.ref.type === "lead") {
        body.serviceAddress = draft.address;
      }

      if (workspace.ref.type === "property" && workspace.property) {
        body.homeownerId = workspace.property.homeownerId;
        body.fullName = draft.name;
        body.propertyName = workspace.property.name;
        body.address = draft.address;
        body.city = draft.city;
        body.state = draft.state;
        body.zip = draft.zip;
        body.squareFeet = draft.squareFeet
          ? Number.parseInt(draft.squareFeet, 10)
          : null;
      }

      if (workspace.ref.type === "presentation") {
        body.customNotes = draft.notes;
      }

      const response = await fetch(
        `/api/admin/customer-workspace/${workspace.ref.type}/${workspace.ref.id}`,
        {
          method: "PATCH",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      const data = (await response.json()) as { workspace: CustomerWorkspace };
      setWorkspace(data.workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const runLeadAction = async (
    action: () => Promise<void>,
  ) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="craft-stage relative min-h-screen px-4 py-10 text-foreground sm:px-6">
      <div className="craft-stage-warmth pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-5xl">
        <HqFounderNav />

        <Link
          href={ROUTES.hq}
          className="mt-8 inline-block text-[10px] uppercase tracking-widest text-muted transition hover:text-foreground"
        >
          ← Headquarters
        </Link>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Loading workspace…</p>
        ) : error && !workspace ? (
          <p className="mt-8 text-sm text-red-500">{error}</p>
        ) : workspace ? (
          <>
            <header className="mt-8 mb-10">
              <p className="text-[10px] uppercase tracking-[0.24em] text-accent">
                Customer workspace · {workspace.stageLabel}
              </p>
              <h1 className="mt-3 font-serif text-3xl font-light tracking-[-0.02em] sm:text-4xl">
                {workspace.headline}
              </h1>
              {workspace.subheadline ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                  {workspace.subheadline}
                </p>
              ) : null}
            </header>

            {error ? <p className="mb-4 text-sm text-red-500">{error}</p> : null}

            <div className="mb-10 flex flex-wrap gap-2.5">
              {workspace.actions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className={
                    action.primary
                      ? "rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-foreground transition hover:border-accent/60"
                      : "rounded-full border border-border/50 px-4 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-border hover:text-foreground"
                  }
                >
                  {action.label}
                </Link>
              ))}
              {workspace.lead && workspace.lead.status === "new" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void runLeadAction(() =>
                      updateLeadIntakeStatusClient(workspace.lead!.id, "contacted").then(
                        () => undefined,
                      ),
                    )
                  }
                  className="rounded-full border border-border/50 px-4 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-border hover:text-foreground disabled:opacity-40"
                >
                  Mark contacted
                </button>
              ) : null}
              {workspace.lead &&
              workspace.lead.status !== "scheduled" &&
              workspace.lead.status !== "archived" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void runLeadAction(async () => {
                      const href = await schedulePresentationFromLead(workspace.lead!);
                      router.push(href);
                    })
                  }
                  className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-foreground transition hover:border-accent/60 disabled:opacity-40"
                >
                  Schedule presentation
                </button>
              ) : null}
              {workspace.lead && workspace.lead.status !== "archived" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void runLeadAction(() =>
                      updateLeadIntakeStatusClient(workspace.lead!.id, "archived").then(
                        () => undefined,
                      ),
                    )
                  }
                  className="rounded-full border border-border/50 px-4 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-border hover:text-foreground disabled:opacity-40"
                >
                  Archive request
                </button>
              ) : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="Contact">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                    Name
                  </span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className={`mt-1.5 ${craftInput}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                    Email
                  </span>
                  <input
                    value={draft.email}
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                    className={`mt-1.5 ${craftInput}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                    Phone
                  </span>
                  <input
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    className={`mt-1.5 ${craftInput}`}
                  />
                </label>
                {workspace.contact.preferredContact ? (
                  <Field
                    label="Preferred contact"
                    value={workspace.contact.preferredContact}
                  />
                ) : null}
              </Section>

              <Section title="Property">
                {workspace.property ? (
                  <>
                    <Field label="Property name" value={workspace.property.name} />
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                        Address
                      </span>
                      <input
                        value={draft.address}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, address: e.target.value }))
                        }
                        className={`mt-1.5 ${craftInput}`}
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                          City
                        </span>
                        <input
                          value={draft.city}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, city: e.target.value }))
                          }
                          className={`mt-1.5 ${craftInput}`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                          State
                        </span>
                        <input
                          value={draft.state}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, state: e.target.value }))
                          }
                          className={`mt-1.5 ${craftInput}`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                          Zip
                        </span>
                        <input
                          value={draft.zip}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, zip: e.target.value }))
                          }
                          className={`mt-1.5 ${craftInput}`}
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                        Square feet
                      </span>
                      <input
                        value={draft.squareFeet}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, squareFeet: e.target.value }))
                        }
                        className={`mt-1.5 ${craftInput}`}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                        Service address
                      </span>
                      <input
                        value={draft.address}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, address: e.target.value }))
                        }
                        className={`mt-1.5 ${craftInput}`}
                      />
                    </label>
                    {workspace.lead?.squareFootage ? (
                      <Field
                        label="Square feet"
                        value={workspace.lead.squareFootage.toLocaleString("en-US")}
                      />
                    ) : null}
                  </>
                )}
              </Section>

              <Section title="Membership & payment">
                {workspace.membership ? (
                  <>
                    <Field label="Plan" value={workspace.membership.planName} />
                    <Field label="Status" value={workspace.membership.status} />
                    {workspace.membership.visitPrice ? (
                      <Field
                        label="Visit price"
                        value={formatTierPrice(workspace.membership.visitPrice)}
                      />
                    ) : null}
                    {workspace.paymentHeadline ? (
                      <Field label="Payment" value={workspace.paymentHeadline} />
                    ) : null}
                    {workspace.paymentDetail ? (
                      <p className="text-muted">{workspace.paymentDetail}</p>
                    ) : null}
                  </>
                ) : workspace.lead ? (
                  <>
                    <Field
                      label="Request status"
                      value={formatLeadIntakeStatus(workspace.lead.status)}
                    />
                    <Field
                      label="Services"
                      value={workspace.lead.servicesInterested.join(", ")}
                    />
                  </>
                ) : (
                  <p className="text-muted">No membership yet.</p>
                )}
              </Section>

              <Section title="Presentation & agreement">
                {workspace.presentation ? (
                  <>
                    <Field label="Presentation" value={workspace.presentation.status} />
                    <Field label="Tier" value={workspace.presentation.tier} />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        href={workspace.presentation.editHref}
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        Edit presentation
                      </Link>
                      <Link
                        href={workspace.presentation.presentHref}
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        {workspace.presentation.status === "signed"
                          ? "Continue onboarding"
                          : "Present"}
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="text-muted">No presentation yet.</p>
                )}
                {workspace.agreement ? (
                  <>
                    <Field
                      label="Agreement"
                      value={new Date(workspace.agreement.signedAt).toLocaleDateString()}
                    />
                    {workspace.agreement.pdfUrl ? (
                      <a
                        href={workspace.agreement.pdfUrl}
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        View signed agreement
                      </a>
                    ) : null}
                  </>
                ) : null}
                {workspace.portalUrl ? (
                  <a
                    href={workspace.portalUrl}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    Open member portal
                  </a>
                ) : null}
              </Section>

              <Section title="Upcoming work">
                {workspace.upcomingWork.length > 0 ? (
                  workspace.upcomingWork.map((item) => (
                    <div key={item.id}>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-muted">
                        {item.date} · {item.status}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">Nothing scheduled yet.</p>
                )}
              </Section>

              <Section title="Completed work">
                {workspace.completedWork.length > 0 ? (
                  workspace.completedWork.map((item) => (
                    <div key={item.id}>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-muted">
                        {item.date} · {item.status}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">No completed visits yet.</p>
                )}
              </Section>

              <Section title="Notes">
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={5}
                  className={craftTextarea}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveWorkspace()}
                  className="rounded-full border border-foreground/15 bg-foreground/[0.04] px-4 py-2 text-xs uppercase tracking-[0.14em] text-foreground transition hover:border-foreground/25 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </Section>

              <Section title="Timeline" rim>
                {workspace.timeline.length > 0 ? (
                  workspace.timeline.map((entry) => (
                    <div key={entry.id} className="border-b border-border/20 pb-3 last:border-0">
                      <p className="font-medium text-foreground">{entry.title}</p>
                      <p className="text-xs text-muted">
                        {new Date(entry.date).toLocaleString("en-US")}
                      </p>
                      {entry.detail ? (
                        <p className="mt-1 text-muted">{entry.detail}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-muted">The story starts here.</p>
                )}
              </Section>
            </div>

            {workspace.lead ? (
              <div className="mt-5 text-sm text-muted">
                Original request ·{" "}
                <Link
                  href={ROUTES.hqPendingRequests}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  inbox
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
