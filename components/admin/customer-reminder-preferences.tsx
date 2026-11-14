"use client";
import { useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { parseReminderOffsets } from "@/lib/communications/reminder-preferences";

export function CustomerReminderPreferences({ conversationId }: { conversationId: string }) {
  const [hours, setHours] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/admin/communications/${encodeURIComponent(conversationId)}/reminder-preferences`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { headers: getAdminRequestHeaders(), signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load timing");
        if (!controller.signal.aborted) { setHours(result.offsetMinutes.map((n: number) => n / 60).join(", ")); setLoaded(true); }
      }).catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Could not load timing"); });
    return () => controller.abort();
  }, [endpoint]);
  async function save() {
    if (busy || !loaded) return;
    setBusy(true); setNotice("");
    try {
      const offsetMinutes = parseReminderOffsets(hours.trim() ? hours.split(",").map((n) => Number(n.trim()) * 60) : []);
      const response = await fetch(endpoint, { method: "PATCH", headers: getAdminRequestHeaders(), body: JSON.stringify({ offsetMinutes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save timing");
      setHours(result.offsetMinutes.map((n: number) => n / 60).join(", "));
      setNotice("Timing saved. Consent and automation switches are unchanged.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save timing"); }
    finally { setBusy(false); }
  }
  return <section className="border-t border-white/10 p-4 text-sm" aria-label="Customer visit reminders">
    <h3 className="font-medium">Visit reminder timing</h3>
    <p className="mt-1 text-xs text-muted">For this customer account. Based on the current visit date/time, checked every 5 minutes. Quiet hours and contact consent still apply. Changes apply to future reminder times only.</p>
    <div className="my-3 flex flex-wrap gap-2">
      {[["1 week", "168"], ["1 day", "24"], ["Both", "168, 24"], ["Off", ""]].map(([label, value]) => <button type="button" key={label} disabled={!loaded || busy} onClick={() => setHours(value)} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">{label}</button>)}
    </div>
    <label className="block text-xs">Custom hours before visit (comma-separated, up to 4)
      <input aria-label="Reminder hours before visit" className="mt-1 block w-full rounded border border-white/20 bg-black/20 p-2" value={hours} disabled={!loaded || busy} onChange={(event) => setHours(event.target.value)} placeholder="168, 24" />
    </label>
    <p className="mt-1 text-xs text-muted">1–720 hours. Leave blank to turn reminders off for this account. This does not opt anyone into texts.</p>
    <button type="button" className="mt-2 rounded border border-white/20 px-3 py-2 disabled:opacity-40" disabled={!loaded || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save reminder timing"}</button>
    {notice && <p role="status" className="mt-2 text-xs">{notice}</p>}
  </section>;
}
