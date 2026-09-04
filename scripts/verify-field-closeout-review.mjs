// UI-only fixture verification against a local production build. No live writes.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.FIELD_TEST_BASE || "http://127.0.0.1:3013";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error("Local fixture server required");
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const assignmentId = "11111111-1111-4111-8111-111111111111";
const now = new Date().toISOString();
const clock = { state: "finished", startedAt: now, endedAt: now, durationSeconds: 3600, startedByDisplayName: "Internal test tech", finishedByDisplayName: "Internal test tech" };
const visit = { projectionId: "fixture-projection", externalVisitId: "fixture-visit", clientName: "Internal test household", title: "Window cleaning", jobNumber: 1,
  visitStatus: "SCHEDULED", jobStatus: "ACTIVE", scheduledStart: now, scheduledEnd: null, isComplete: false, assignedUsers: [], assignmentReadState: "available", scopeItems: [], scopeReadState: "available",
  propertyLabel: "Internal test property", jobberPropertyWebUri: null, jobberClientWebUri: null, homeAtlasPropertyId: null, homeAtlasAppointmentId: null, homeAtlasMembershipId: null, homeAtlasPortalPath: null,
  homeAtlasFieldAssignmentId: assignmentId, homeAtlasAssignedTechnicianId: "homeatlas:test", homeAtlasAssignedTechnicianName: "Internal test tech",
  homeAtlasFieldRecordCount: 1, homeAtlasLatestFieldRecordAt: now, homeAtlasLatestFieldRecordBy: "Internal test tech", homeAtlasCustomerVisibleRecordCount: 0, homeAtlasOpenFollowUpCount: 1,
  homeAtlasFieldCustomerSummary: "Exterior glass cleaned.", homeAtlasFieldInternalNote: "Inspect the gate latch.", homeAtlasFieldScopeException: "Side window inaccessible.", homeAtlasFieldPhotoCount: 1,
  homeAtlasFieldStage: "departed", homeAtlasFieldStageAt: now, homeAtlasFieldStageBy: "Internal test tech", homeAtlasFieldEventCount: 0, homeAtlasJobClock: clock, homeAtlasIndependenceReview: null };
const board = { calendarDate: now.slice(0,10), timezone: "America/Los_Angeles", connected: true, connectionStatus: "connected", accountName: "Internal fixture", lastSyncedAt: now, loadedAt: now,
  fieldRecordStatusAvailable: true, fieldEventStatusAvailable: true, jobClockStatusAvailable: true, independenceReviewStatusAvailable: true, fieldFollowUps: [], visits: [visit],
  summary: { total: 1, complete: 0, remaining: 1, documented: 1, portalUpdated: 0, completedWithoutRecord: 0, completedWithPrivateOnlyRecord: 0, jobberCompletionPending: 1, assigned: 1, unassigned: 0, assignmentUnknown: 0 } };
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: "reduce" });
    if (process.env.ADMIN_PIN) {
      const unlock = await context.request.post(`${base}/api/admin/unlock`, { headers: { "x-admin-pin": process.env.ADMIN_PIN } });
      assert.equal(unlock.status(), 200, "Configured local owner login must succeed");
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let failEvidence = false;
    let evidenceReads = 0;
    let failUpcoming = false;
    let inviteSends = 0;
    let ownerBoard = board;
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/admin/unlock") return route.fulfill({ json: { mode: "pin" } });
      if (path === "/api/admin/technicians/access-grants") return route.fulfill({ json: route.request().method() === "POST" ? { grantId: assignmentId, inviteExpiresAt: now, claimPath: "/tech/access?token=" + "a".repeat(43) } : { crew: [{ jobberUserId: "homeatlas:" + assignmentId, displayName: "Internal Test", source: "homeatlas", observedStopCount: 0, latestObservedAt: null, currentGrant: null }], grants: [] } });
      if (path === `/api/admin/technicians/access-grants/${assignmentId}/sms`) { inviteSends++; return route.fulfill({ json: { status: "queued", destinationEnding: "0199", receiptSaved: true } }); }
      if (path === "/api/admin/care-operations/jobber/today") return route.fulfill({ json: ownerBoard });
      if (path === "/api/field/today") return route.fulfill({ json: board });
      if (path === "/api/field/upcoming") return route.fulfill(failUpcoming ? { status: 503, json: { error: "Schedule temporarily unavailable" } } : { json: { visits: [{ id: "future-1", clientName: "Future assigned household", service: "Exterior glass and screens", scheduledStart: "2026-09-15T16:00:00Z", scheduledEnd: null, address: "1 Test Street" }] } });
      if (path === `/api/admin/field-records/${assignmentId}`) {
        evidenceReads++;
        return route.fulfill(failEvidence ? { status: 503, json: { error: "Evidence temporarily unavailable" } } : { json: {
          technicianName: "Internal test tech", visitDate: now.slice(0,10), savedAt: now, customerSummary: "Exterior glass cleaned.", internalNote: "Inspect the gate latch.", scopeException: "Side window inaccessible.", followUpNeeded: true,
          photos: [{ id: "test-photo", captureType: "after", mimeType: "image/jpeg", url: null }],
        } });
      }
      return route.fulfill({ status: 404, json: { error: "Not part of fixture" } });
    });
    await page.goto(`${base}/hq/today`);
    const button = page.getByRole("button", { name: "Review technician notes + photos" });
    await button.waitFor({ timeout: 12000 }).catch(async error => {
      console.error((await page.locator("body").innerText()).slice(0, 2000));
      throw error;
    });
    await page.getByText("HomeAtlas technician · Internal test tech", { exact: true }).waitFor();
    await page.getByText("Actual job time", { exact: true }).waitFor();
    assert.equal(evidenceReads, 0, "Evidence should load only on request");
    await button.focus();
    await page.keyboard.press("Enter");
    await page.getByText("Inspect the gate latch.", { exact: true }).waitFor();
    await page.getByText("Side window inaccessible.", { exact: true }).waitFor();
    await page.getByText("Photo 1 could not be opened.", { exact: true }).waitFor();
    assert.equal(await button.getAttribute("aria-expanded"), "true");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
    failEvidence = true;
    await page.getByRole("button", { name: "Refresh evidence and photo links" }).click();
    await page.getByText("Evidence temporarily unavailable", { exact: true }).waitFor();
    failEvidence = false;
    await page.getByRole("button", { name: "Refresh evidence and photo links" }).click();
    await page.getByText("Inspect the gate latch.", { exact: true }).waitFor();
    await page.screenshot({ path: `${process.env.TEMP || "/tmp"}/homeatlas-evidence-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    ownerBoard = { ...board, visits: [{ ...visit, isComplete: true }],
      summary: { ...board.summary, complete: 1, remaining: 0, jobberCompletionPending: 0 } };
    await page.reload();
    await page.getByRole("button", { name: "Review technician notes + photos" }).waitFor();
    assert.equal(await page.getByText("Customer portal update needed", { exact: true }).count(), 0, "Native private evidence is a valid closeout");
    assert.equal(await page.getByText("Close this visit in Jobber", { exact: true }).count(), 0, "Completed Jobber visits require no further completion");
    await page.getByRole("link", { name: "Optional customer portal pairing" }).waitFor();
    await page.screenshot({ path: `${process.env.TEMP || "/tmp"}/homeatlas-native-complete-${width}.png`, fullPage: true });
    ownerBoard = { ...ownerBoard, visits: [{ ...ownerBoard.visits[0], homeAtlasFieldAssignmentId: null, homeAtlasAssignedTechnicianId: null, homeAtlasAssignedTechnicianName: null }],
      summary: { ...ownerBoard.summary, completedWithPrivateOnlyRecord: 1, assigned: 0, unassigned: 1 } };
    await page.reload();
    await page.getByText("Customer portal update needed", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Review technician notes + photos" }).count(), 0, "Legacy visit must not request unrelated native evidence");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, nativePrivateCloseout: "accepted", legacyPortalWarning: "preserved" }));
    await page.goto(`${base}/tech`);
    const nativeCrewLens = page.getByRole("button", { name: "Internal test tech · 1", exact: true });
    await nativeCrewLens.waitFor();
    await nativeCrewLens.click();
    await page.getByRole("heading", { name: "Internal test household", exact: true }).waitFor();
    assert.equal(await nativeCrewLens.getAttribute("aria-pressed"), "true");
    assert.equal(await page.getByText("Unassigned in Jobber", { exact: true }).count(), 0);
    const techAccent = await page.locator(".atlas-role-shell").first().evaluate(el => getComputedStyle(el).getPropertyValue("--accent").trim());
    const upcoming = page.getByRole("button", { name: /Upcoming jobs/ });
    await upcoming.focus();
    await page.keyboard.press("Enter");
    await page.getByText("Future assigned household", { exact: true }).waitFor();
    await page.getByText("Exterior glass and screens", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Upcoming schedule must fit mobile");
    failUpcoming = true;
    await page.getByRole("button", { name: "Refresh upcoming jobs" }).click();
    await page.getByText("Schedule temporarily unavailable", { exact: true }).waitFor();
    failUpcoming = false;
    await page.getByRole("button", { name: "Refresh upcoming jobs" }).click();
    await page.getByText("Future assigned household", { exact: true }).waitFor();
    await page.screenshot({ path: `${process.env.TEMP || "/tmp"}/homeatlas-upcoming-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, upcomingSchedule: "passed", keyboard: "passed", scheduleRetry: "passed" }));
    await page.goto(`${base}/hq/technicians`);
    const hqAccent = await page.getByRole("button", { name: "Create access", exact: true }).evaluate(el => getComputedStyle(el).getPropertyValue("--accent").trim());
    assert.ok(techAccent, "Technician accent token must exist");
    assert.equal(techAccent, hqAccent, "Technician and HQ must inherit the same accent palette");
    await page.getByRole("button", { name: "Create access", exact: true }).click();
    const textInvite = page.getByRole("button", { name: "Text invite to registered phone", exact: true });
    await textInvite.click();
    await page.getByText("Text status: queued · phone ending 0199.", { exact: true }).waitFor();
    assert.equal(await textInvite.isEnabled(), false);
    assert.equal(inviteSends, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Invitation controls must fit mobile");
    await page.screenshot({ path: `${process.env.TEMP || "/tmp"}/homeatlas-team-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, invitationUI: "passed", duplicateSendPrevented: true }));
    console.log(JSON.stringify({ width, evidenceReads, keyboard: "passed", notes: "passed", storageError: "passed", retry: "passed", overflow: "none", pageErrors: 0 }));
    await page.goto(`${base}/tech/refer`);
    await page.getByRole("button", { name: /Preview referral handoff|Send referral to HQ/i }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Referral form must fit mobile");
    await page.screenshot({ path: `${process.env.TEMP || "/tmp"}/homeatlas-referral-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, sharedPalette: techAccent, referralLayout: "passed" }));
    await context.close();
  }
} finally { await browser.close(); }
