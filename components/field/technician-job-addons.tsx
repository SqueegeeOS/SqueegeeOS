"use client";

import { useEffect, useRef, useState } from "react";
import { dollarsToAddonCents, type TechnicianJobAddonReport } from "@/lib/field-operations/technician-job-addon";

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function TechnicianJobAddons({ assignmentId }: { assignmentId: string }) {
  const [reports, setReports] = useState<TechnicianJobAddonReport[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => setLoading(true), 0);
    fetch(`/api/field/job-addons?assignmentId=${encodeURIComponent(assignmentId)}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as { reports?: TechnicianJobAddonReport[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Add-ons could not load.");
      setReports(body.reports ?? []);
      setError(null);
      setLoaded(true);
    }).catch((loadError) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Add-ons could not load.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [assignmentId, loaded, open]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const amount = dollarsToAddonCents(price);
    const service = serviceName.trim();
    if (service.length < 2 || service.length > 120 || amount === null) {
      setError("Enter a service and a price between $0.01 and $10,000.");
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/field/job-addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: requestId.current, assignmentId,
          serviceName: service, reportedAmountCents: amount,
        }),
      });
      const body = await response.json() as { report?: TechnicianJobAddonReport; error?: string };
      if (!response.ok || !body.report) throw new Error(body.error ?? "Add-on could not be saved.");
      setReports((current) => [body.report!, ...current.filter((item) => item.id !== body.report!.id)]);
      setServiceName("");
      setPrice("");
      requestId.current = null;
      setNotice("Add-on reported to HQ. Billing and pay are reviewed separately.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Add-on could not be saved.");
    } finally { setPending(false); }
  }

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="mt-3 rounded-2xl border border-foreground/12 bg-background/60 p-4">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Add-ons · {reports.filter((item) => !item.voidedAt).length} reported</summary>
      <p className="mt-3 text-xs leading-relaxed text-muted">Customer agreed to extra work? Log the service and agreed price here. This records your report; it does not charge the customer or change Jobber.</p>
      <form onSubmit={(event) => void save(event)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <label className="text-xs text-muted">Service
          <input required minLength={2} maxLength={120} value={serviceName} onChange={(event) => { setServiceName(event.target.value); requestId.current = null; }} placeholder="e.g. screen cleaning" className="mt-1 block min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted">Agreed price ($)
          <input required inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); requestId.current = null; }} placeholder="40.00" className="mt-1 block min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm text-foreground" />
        </label>
        <button type="submit" disabled={pending || loading || !loaded} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "Log add-on"}</button>
      </form>
      {error ? <p role="alert" className="mt-3 text-xs text-danger">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-xs text-success">{notice}</p> : null}
      {loading ? <p className="mt-3 text-xs text-muted">Loading reports…</p> : null}
      {!loading && reports.length ? <ul className="mt-4 divide-y divide-foreground/10 border-t border-foreground/10 text-sm">{reports.map((item) => <li key={item.id} className="flex justify-between gap-3 py-2"><span className={item.voidedAt ? "text-muted line-through" : "text-foreground"}>{item.serviceName}</span><span className="tabular-nums text-foreground/75">{usd(item.reportedAmountCents)}{item.voidedAt ? " · voided" : ""}</span></li>)}</ul> : null}
    </details>
  );
}
