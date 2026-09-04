// Local production-build UI fixtures only. No leads, emails or customer writes.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.FIELD_TEST_BASE || "http://127.0.0.1:3013";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error("Local fixture server required");
const id = "11111111-1111-4111-8111-111111111111";
const now = "2026-09-04T15:00:00Z";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const workspace = {
  ref: { type: "presentation", id }, canonical: null, stage: "presenting", stageLabel: "Presentation", headline: "Internal referral household", subheadline: "Synthetic test only",
  contact: { name: "Internal referral household", email: null, phone: null, preferredContact: null }, property: null, lead: null, presentation: null, membership: null, agreement: null, portalUrl: null, paymentHeadline: null, paymentDetail: null,
  notes: "", upcomingWork: [], completedWork: [], timeline: [], closedJobs: [], actions: [],
  technicianReferralCredit: { status: "recorded", technicianName: "Internal test technician", leadId: id, submittedAt: now, presentationId: id },
};
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: "reduce" });
    const unlock = await context.request.post(`${base}/api/admin/unlock`, { headers: { "x-admin-pin": process.env.ADMIN_PIN || "" } });
    assert.equal(unlock.status(), 200);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let current = workspace;
    const writes = [];
    await page.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/admin/unlock") return route.fulfill({ json: { mode: "pin" } });
      if (route.request().method() !== "GET") writes.push(`${route.request().method()} ${path}`);
      if (path.startsWith("/api/admin/customer-workspace/")) return route.fulfill({ json: { workspace: current } });
      return route.fulfill({ status: 404, json: { error: "Not part of fixture" } });
    });
    await page.goto(`${base}/hq/customers/presentation/${id}`);
    const card = page.getByRole("region", { name: "Technician referral credit" });
    await card.getByRole("heading", { name: "Referred by Internal test technician" }).waitFor();
    await card.getByText(/A signature or card on file is not proof of payment/).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${process.env.TEMP || "/tmp"}/homeatlas-referral-credit-${width}.png`, fullPage: true });
    const original = card.getByRole("link", { name: "Open original referral" });
    await original.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(`**/hq/customers/lead/${id}`);
    await card.getByRole("heading", { name: "Referred by Internal test technician" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Open original referral" }).count(), 0, "No circular self-link on the original referral");
    current = { ...workspace, technicianReferralCredit: { status: "unavailable" } };
    await page.reload();
    await page.getByRole("heading", { name: "Referral credit unavailable" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Open original referral" }).count(), 0);
    current = { ...workspace, technicianReferralCredit: null };
    await page.reload();
    await page.getByRole("heading", { name: "Internal referral household", exact: true }).waitFor();
    assert.equal(await page.getByRole("region", { name: "Technician referral credit" }).count(), 0);
    assert.deepEqual(writes, [], "Only the local authentication check may POST");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, credit: "visible", keyboardOriginalLink: "passed", unavailableAndAbsent: "passed", writes }));
    await context.close();
  }
} finally { await browser.close(); }
