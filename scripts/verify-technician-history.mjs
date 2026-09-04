// Local production-build UI rehearsal. Every business API is intercepted.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.FIELD_TEST_BASE || "http://127.0.0.1:3013";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error("Local fixture server required");
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const stamp = "2026-09-04T15:00:00.123456+00:00";
const fixture = (n, overrides = {}) => ({ assignmentId: id(n), clientName: `Internal household ${n}`, service: "Exterior glass and screens", technicianName: "Internal test technician",
  clock: { state: "finished", startedAt: stamp, endedAt: "2026-09-04T16:30:00Z", durationSeconds: 5400, startedByDisplayName: "Internal test technician", finishedByDisplayName: "Internal test technician" },
  hasCloseout: true, openFollowUp: true, photoCount: 1, jobberComplete: false, jobberStatus: "SCHEDULED", invoiceStatus: "paid", sourceObservedAt: stamp, ...overrides });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: "reduce" });
    if (process.env.ADMIN_PIN) {
      const unlock = await context.request.post(`${base}/api/admin/unlock`, { headers: { "x-admin-pin": process.env.ADMIN_PIN } });
      assert.equal(unlock.status(), 200);
    }
    const page = await context.newPage();
    const errors = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    let fail = false, resolution = null, historyReads = 0, evidenceReads = 0;
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === "/api/admin/unlock") return route.fulfill({ json: { mode: "pin" } });
      if (request.method() !== "GET") writes.push(url.pathname);
      if (url.pathname === "/api/admin/field-records/history") {
        historyReads++;
        const month = url.searchParams.get("month"), cursor = url.searchParams.get("cursor");
        if (fail) return route.fulfill({ status: 503, json: { error: "History temporarily unavailable" } });
        if (month === "2000-01") return route.fulfill({ json: { month, items: [], nextCursor: null } });
        if (cursor) {
          assert.equal(cursor, `${stamp}|${id(1)}`);
          return route.fulfill({ json: { month, items: [fixture(2, { hasCloseout: false, invoiceStatus: null, clock: { ...fixture(1).clock, state: "running", endedAt: null, durationSeconds: null } })], nextCursor: null } });
        }
        return route.fulfill({ json: { month, items: [fixture(1, { openFollowUp: !resolution })], nextCursor: `${stamp}|${id(1)}` } });
      }
      if (url.pathname === `/api/admin/field-records/${id(1)}`) {
        if (request.method() === "PATCH") {
          const body = request.postDataJSON();
          assert.equal(body.fieldRecordId, id(1));
          resolution = { note: body.note, resolvedBy: "Internal owner", resolvedAt: stamp };
          return route.fulfill({ json: { resolution } });
        }
        evidenceReads++;
        return route.fulfill({ json: { fieldRecordId: id(1), resolution, technicianName: "Internal test technician", visitDate: "2026-09-04", savedAt: stamp,
          customerSummary: "Glass cleaned.", internalNote: "Inspect gate latch.", scopeException: null, followUpNeeded: true,
          photos: [{ id: "fixture-photo", captureType: "after", mimeType: "image/jpeg", url: null }] } });
      }
      return route.fulfill({ status: 404, json: { error: "Outside fixture scope" } });
    });
    await page.goto(`${base}/hq/technician-history`);
    await page.getByRole("heading", { name: "Internal household 1", exact: true }).waitFor();
    await page.getByText("1h 30m", { exact: true }).waitFor();
    await page.getByText("Paid in Jobber", { exact: true }).waitFor();
    await page.getByText("Owner follow-up needed", { exact: true }).waitFor();
    assert.equal(evidenceReads, 0, "Private evidence loads only when opened");
    const review = page.getByRole("button", { name: "Review technician notes + photos" });
    await review.focus(); await page.keyboard.press("Enter");
    await page.getByText("Inspect gate latch.", { exact: true }).waitFor();
    await page.getByLabel("What resolved the issue?").fill("Inspected latch; no repair needed.");
    await page.getByRole("button", { name: "Save resolution", exact: true }).click();
    await page.getByRole("heading", { name: "Resolved in HQ", exact: true }).waitFor();
    await page.getByText("Review completion in Jobber", { exact: true }).waitFor();
    assert.equal(historyReads, 1, "Resolution must not reload or collapse history");
    await page.getByRole("button", { name: "Load older jobs", exact: true }).click();
    await page.getByRole("heading", { name: "Internal household 2", exact: true }).waitFor();
    await page.getByText("Still clocked in", { exact: true }).waitFor();
    assert.equal(await page.locator("article").count(), 2);
    assert.equal(await page.getByRole("button", { name: "Load older jobs", exact: true }).count(), 0);
    fail = true;
    await page.getByRole("button", { name: "Refresh history", exact: true }).click();
    await page.getByText("History temporarily unavailable", { exact: false }).first().waitFor();
    assert.equal(await page.locator("article").count(), 2, "Failed refresh keeps last loaded evidence");
    fail = false;
    await page.getByRole("button", { name: "Retry history", exact: true }).click();
    await page.getByRole("button", { name: "Load older jobs", exact: true }).waitFor();
    assert.equal(await page.locator("article").count(), 1, "Fresh first-page read resets pagination");
    await page.getByText("Review completion in Jobber", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
    await page.screenshot({ path: `${process.env.TEMP || "/tmp"}/homeatlas-history-${width}.png`, fullPage: true });
    await page.getByLabel("Clock-in month").fill("2000-01");
    await page.getByText("No HomeAtlas technician clock-ins recorded for this month.", { exact: false }).waitFor();
    assert.equal(await page.locator("article").count(), 0, "Month switch must clear previous month's jobs");
    assert.deepEqual(writes, [`/api/admin/field-records/${id(1)}`], "Only the explicit mocked issue resolution is written");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, result: "passed", historyReads, evidenceReads, localOnly: true }));
    await context.close();
  }
} finally { await browser.close(); }
