"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HqFounderNav } from "./hq-founder-nav";
import { PUBLIC_SERVICES } from "@/lib/marketing/public-services";
import { MARKETING_CALENDAR, exportContentCalendar } from "@/lib/marketing/content-calendar";
import { buildJobContentPack, exportJobContentPack, type MarketingDraft } from "@/lib/marketing/job-content";
import type { ReviewRequestAutomationStatus } from "@/lib/aftercare/review-request-automation-server";

interface MarketingContext {
  visitsAvailable: boolean;
  visits: { id: string; serviceLabel: string; completedAt: string }[];
  reviewAutomation: ReviewRequestAutomationStatus | null;
  reviewUrl: string | null;
}

const inputClass = "mt-2 w-full rounded-xl border border-white/20 bg-[#102d23] px-4 py-3 text-base text-[#f4efe4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4bd8d]";
const buttonClass = "inline-flex min-h-12 items-center justify-center rounded-full border border-[#d4bd8d]/50 px-6 py-3 text-sm font-medium text-[#f4efe4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4bd8d] disabled:opacity-50";

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MarketingDesk() {
  const [context, setContext] = useState<MarketingContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serviceSlug, setServiceSlug] = useState("window-cleaning");
  const [area, setArea] = useState("Chico");
  const [workPerformed, setWorkPerformed] = useState("");
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [mediaApproved, setMediaApproved] = useState(false);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/marketing", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to Headquarters again to load live review status." : "Live review status is unavailable. You can still prepare drafts.");
        setContext(await response.json() as MarketingContext);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Live context is unavailable.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopyStatus("Copied to clipboard."); }
    catch { setCopyStatus("Clipboard unavailable. Select the draft text or download the pack."); }
  }

  function createDrafts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setDrafts([]);
    try { setDrafts(buildJobContentPack({ serviceSlug, area, workPerformed, factsConfirmed, mediaApproved, reviewUrl: context?.reviewUrl })); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Check the job details."); }
  }

  return (
    <main className="min-h-screen bg-[#071c16] px-5 pb-24 pt-8 text-[#f4efe4] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <HqFounderNav />
        <header className="mt-12">
          <p className="text-xs uppercase tracking-[0.25em] text-[#d4bd8d]">SqueegeeKing · Marketing</p>
          <h1 className="mt-4 font-serif text-5xl font-light sm:text-7xl">Let the work tell the story.</h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-[#f4efe4]/75">Prepare job captions, filming scripts, and website stories. Review the facts and media before publishing. This workspace creates drafts; it does not send messages or post to your accounts.</p>
        </header>

        <section className="mt-10 rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-8" aria-labelledby="review-readiness">
          <h2 id="review-readiness" className="font-serif text-3xl">Review requests</h2>
          <p role="status" className="mt-4 text-[#f4efe4]/75">{loadError ?? context?.reviewAutomation?.detail ?? (context ? "Live automation status is unavailable." : "Checking review readiness…")}</p>
          {context?.reviewUrl ? <a href={context.reviewUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block underline underline-offset-4">Open the verified review destination ↗</a> : null}
          <div className="mt-5 flex flex-wrap gap-5 text-sm"><Link href="/hq/aftercare" className="underline underline-offset-4">Open Aftercare</Link><Link href="/hq/communications" className="underline underline-offset-4">Review automation settings</Link><Link href="/setup/google-reviews" className="underline underline-offset-4">Google Reviews setup</Link></div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/15 p-6 sm:p-8" aria-labelledby="job-pack-title">
          <h2 id="job-pack-title" className="font-serif text-3xl">One job. A ready-to-edit content pack.</h2>
          {context?.visits.length ? <details className="mt-5 rounded-2xl bg-white/5 p-4"><summary className="cursor-pointer">Completed visits awaiting review follow-up ({context.visits.length})</summary><p className="mt-3 text-sm text-[#f4efe4]/70">These are Aftercare references, not the full job history or permission to publish. Open the source record in Aftercare to verify the work.</p><ul className="mt-4 grid gap-2 text-sm">{context.visits.slice(0, 20).map((visit) => <li key={visit.id}>{visit.serviceLabel} · {new Date(visit.completedAt).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })} · reference {visit.id.slice(0, 8)}</li>)}</ul></details> : context ? <p className="mt-4 text-sm text-[#f4efe4]/70">{context.visitsAvailable ? "No eligible review follow-ups are listed. You can still enter a verified job below." : "Completed-visit references could not be loaded. Verify the job in its source record before drafting."}</p> : null}
          <form onSubmit={createDrafts} className="mt-7 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label htmlFor="marketing-service" className="block text-sm">Service<select id="marketing-service" className={inputClass} value={serviceSlug} onChange={(event) => { setServiceSlug(event.target.value); setFactsConfirmed(false); setDrafts([]); }}>{PUBLIC_SERVICES.map((service) => <option key={service.slug} value={service.slug}>{service.name}</option>)}</select></label>
              <label htmlFor="marketing-area" className="block text-sm">City or neighborhood<input id="marketing-area" required maxLength={80} className={inputClass} value={area} onChange={(event) => { setArea(event.target.value); setFactsConfirmed(false); setDrafts([]); }} /></label>
            </div>
            <label htmlFor="marketing-work" className="block text-sm">Confirmed work performed<textarea id="marketing-work" required minLength={20} maxLength={900} rows={5} className={inputClass} value={workPerformed} onChange={(event) => { setWorkPerformed(event.target.value); setFactsConfirmed(false); setDrafts([]); }} aria-describedby="marketing-work-hint" /></label>
            <p id="marketing-work-hint" className="text-sm text-[#f4efe4]/65">Use service details only. Leave names, street addresses, phone numbers, and private property notes in the source record.</p>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={factsConfirmed} onChange={(event) => { setFactsConfirmed(event.target.checked); setDrafts([]); }} className="mt-1 h-4 w-4 accent-[#d4bd8d]" /><span>I verified that this describes work actually completed.</span></label>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={mediaApproved} onChange={(event) => { setMediaApproved(event.target.checked); setDrafts([]); }} className="mt-1 h-4 w-4 accent-[#d4bd8d]" /><span>I have permission for any photos or footage I plan to publish.</span></label>
            {formError ? <p role="alert" className="text-[#ffd2bd]">{formError}</p> : null}
            <button type="submit" className={buttonClass} disabled={!factsConfirmed || !mediaApproved}>Create drafts</button>
          </form>
          {drafts.length ? <div className="mt-8"><button type="button" className={buttonClass} onClick={() => downloadText(exportJobContentPack(drafts), "SqueegeeKing-Job-Marketing-Pack.md")}>Download job pack</button><div className="mt-6 grid gap-5 lg:grid-cols-2">{drafts.map((draft) => <article key={draft.id} className="min-w-0 rounded-2xl bg-white/5 p-5"><h3 className="font-serif text-2xl">{draft.title}</h3><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#f4efe4]/75">{draft.text}</p><button type="button" className={`${buttonClass} mt-5`} onClick={() => void copy(draft.text)}>Copy draft</button></article>)}</div></div> : null}
        </section>

        <section className="mt-10" aria-labelledby="calendar-title">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><h2 id="calendar-title" className="font-serif text-4xl">Your next 30 days of content.</h2><p className="mt-4 text-[#f4efe4]/70">Start on any date. Each entry includes copy and a capture brief.</p></div><button type="button" className={buttonClass} onClick={() => downloadText(exportContentCalendar(), "SqueegeeKing-30-Day-Content-Calendar.md")}>Download calendar</button></div>
          <div className="mt-7 space-y-3">{MARKETING_CALENDAR.map((entry) => <details key={entry.day} className="rounded-2xl border border-white/15 bg-white/5 p-5"><summary className="cursor-pointer font-medium">Day {entry.day} · {entry.title}<span className="mt-1 block text-xs font-normal text-[#d4bd8d]">{entry.channel}</span></summary><p className="mt-5 whitespace-pre-wrap break-words leading-relaxed text-[#f4efe4]/80">{entry.body}</p><p className="mt-5 text-sm text-[#d4bd8d]">Capture: {entry.capture}</p><button type="button" className={`${buttonClass} mt-5`} onClick={() => void copy(entry.body)}>Copy content</button></details>)}</div>
        </section>
        <p role="status" aria-live="polite" className="mt-6 min-h-6 text-sm text-[#d4bd8d]">{copyStatus}</p>
      </div>
    </main>
  );
}
