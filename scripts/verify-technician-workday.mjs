// Local-only technician-role browser rehearsal. No production credentials/data.
// The real claim route and server role check use a narrow synthetic DB adapter;
// workday API responses are stateful browser fixtures, not provider verification.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const hash = value => createHash("sha256").update(value).digest("hex");
const assignmentId = "11111111-1111-4111-8111-111111111111";
const technicianId = "homeatlas:22222222-2222-4222-8222-222222222222";
const base = "http://localhost:3015";
let sessionHash;
const db = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, "http://localhost:3014");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/rest/v1/rpc/claim_technician_access_grant") {
    const input = JSON.parse(raw);
    assert.equal(input.p_invite_token_hash, hash("a".repeat(43)));
    sessionHash = input.p_session_token_hash;
    return res.end(JSON.stringify({ grant_id: assignmentId, jobber_user_id: technicianId, display_name: "Internal Rehearsal Tech", session_expires_at: input.p_session_expires_at }));
  }
  if (url.pathname === "/rest/v1/technician_access_grants" && sessionHash && url.searchParams.get("session_token_hash") === `eq.${sessionHash}`) {
    return res.end(JSON.stringify({ id: assignmentId, jobber_user_id: technicianId, display_name: "Internal Rehearsal Tech", status: "active", access_role: "technician", session_expires_at: "2027-09-04T00:00:00Z" }));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ message: "Not part of local rehearsal" }));
});
await new Promise(resolve => db.listen(3014, "127.0.0.1", resolve));
let serverLog = "";
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3015"], {
  cwd: process.cwd(), windowsHide: true,
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3014", NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-fixture-only", SUPABASE_SERVICE_ROLE_KEY: "local-fixture-only", ADMIN_PIN: "local-fixture-owner-only" },
  stdio: ["ignore", "pipe", "pipe"],
});
next.stdout.on("data", c => { serverLog = (serverLog + c).slice(-5000); });
next.stderr.on("data", c => { serverLog = (serverLog + c).slice(-5000); });
let browser;
try {
  for (let tries = 0; ; tries++) {
    try { if ((await fetch(`${base}/tech/access`)).ok) break; } catch { /* booting */ }
    if (tries > 45) throw new Error(`Local Next server failed to boot: ${serverLog}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const now = new Date().toISOString();
    let recorded = false;
    let commits = 0;
    let photoUploads = 0;
    let photoIntents = 0;
    let failCommit = true;
    let initialRecordId;
    let clock = { state: "not_started", startedAt: null, endedAt: null, durationSeconds: null, startedByDisplayName: null, finishedByDisplayName: null };
    const visit = () => ({ projectionId: "rehearsal-projection", externalVisitId: "rehearsal-visit", clientName: "Internal Test Household", title: "Window cleaning", jobNumber: 1, visitStatus: "SCHEDULED", jobStatus: "ACTIVE", scheduledStart: now, scheduledEnd: null, isComplete: false,
      assignedUsers: [], assignmentReadState: "available", scopeItems: [{ id: "glass", name: "Exterior glass", quantity: 1 }], scopeReadState: "available", propertyLabel: "House nickname", propertyAddress: "1 Test Street, Chico, CA", jobberPropertyWebUri: null, jobberClientWebUri: null,
      homeAtlasPropertyId: "33333333-3333-4333-8333-333333333333", homeAtlasAppointmentId: "44444444-4444-4444-8444-444444444444", homeAtlasMembershipId: null, homeAtlasPortalPath: null,
      homeAtlasFieldAssignmentId: assignmentId, homeAtlasAssignedTechnicianId: technicianId, homeAtlasAssignedTechnicianName: "Internal Rehearsal Tech", homeAtlasFieldRecordCount: recorded ? 1 : 0,
      homeAtlasLatestFieldRecordAt: recorded ? now : null, homeAtlasLatestFieldRecordBy: recorded ? "Internal Rehearsal Tech" : null, homeAtlasCustomerVisibleRecordCount: 0, homeAtlasOpenFollowUpCount: 0,
      homeAtlasFieldCustomerSummary: recorded ? "Exterior glass cleaned." : null, homeAtlasFieldInternalNote: null, homeAtlasFieldScopeException: null, homeAtlasFieldPhotoCount: 0,
      homeAtlasFieldStage: clock.state === "finished" ? "departed" : recorded ? "service_completed" : clock.state === "running" ? "service_started" : "not_started", homeAtlasFieldStageAt: now, homeAtlasFieldStageBy: "Internal Rehearsal Tech", homeAtlasFieldEventCount: 0, homeAtlasJobClock: clock, homeAtlasIndependenceReview: null });
    await page.route("**/storage/v1/object/upload/sign/**", async route => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": base, "access-control-allow-methods": "PUT, POST, OPTIONS", "access-control-allow-headers": "*" } });
      photoUploads++;
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": base }, json: { Key: "local-fixture-photo" } });
    });
    await page.route("**/api/field/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/field/access/claim") return route.continue();
      if (path === "/api/field/today") return route.fulfill({ json: { calendarDate: now.slice(0,10), timezone: "America/Los_Angeles", connected: true, connectionStatus: "connected", lastSyncedAt: now, loadedAt: now, fieldRecordStatusAvailable: true, fieldEventStatusAvailable: true, jobClockStatusAvailable: true, independenceReviewStatusAvailable: true, fieldFollowUps: [], visits: [visit()], summary: { total: 1, complete: 0, remaining: 1, assigned: 1, documented: recorded ? 1 : 0 } } });
      if (path === "/api/field/upcoming") return route.fulfill({ json: { visits: [] } });
      if (path === "/api/field/field-records/upload-intents") {
        photoIntents++;
        const input = route.request().postDataJSON();
        assert.equal(input.fieldAssignmentId, assignmentId);
        assert.equal(input.propertyId, undefined);
        assert.equal(input.appointmentId, undefined);
        assert.ok(input.photos.every(p => p.customerVisible === false));
        return route.fulfill({ json: { bucket: "visit-photos", uploads: input.photos.map(p => ({ ...p, storagePath: `rehearsal/${input.fieldRecordId}/${p.clientId}.png`, token: "local-test-only" })) } });
      }
      if (path === "/api/field/job-clock") {
        const input = route.request().postDataJSON();
        assert.equal(input.fieldAssignmentId, assignmentId);
        assert.equal(input.propertyId, undefined);
        assert.equal(input.appointmentId, undefined);
        if (input.action === "start") clock = { ...clock, state: "running", startedAt: now, startedByDisplayName: "Internal Rehearsal Tech" };
        else { assert.ok(recorded); clock = { ...clock, state: "finished", endedAt: new Date().toISOString(), durationSeconds: 60, finishedByDisplayName: "Internal Rehearsal Tech" }; }
        return route.fulfill({ status: 201, json: { replayed: false } });
      }
      if (path === "/api/field/field-records") {
        const input = route.request().postDataJSON();
        assert.equal(input.fieldAssignmentId, assignmentId);
        assert.equal(input.propertyId, undefined);
        assert.equal(input.appointmentId, undefined);
        assert.equal(input.technicianName, "Internal Rehearsal Tech");
        assert.equal(input.photos.length, 1);
        assert.equal(input.photos[0].customerVisible, false);
        initialRecordId ??= input.fieldRecordId;
        assert.equal(input.fieldRecordId, initialRecordId, "Retry must retain the submission identity");
        if (failCommit) { failCommit = false; return route.fulfill({ status: 503, json: { error: "Rehearsal connection interruption" } }); }
        commits++;
        recorded = true;
        return route.fulfill({ status: 201, json: { fieldRecordId: input.fieldRecordId, photoCount: 0, routeEventRecorded: true } });
      }
      return route.fulfill({ status: 404, json: { error: "Not part of local rehearsal" } });
    });
    await page.goto(`${base}/tech/access?token=${"a".repeat(43)}`);
    await page.getByRole("button", { name: "Activate my workspace" }).click();
    await page.getByRole("button", { name: /I’m here · Start job/ }).waitFor({ timeout: 30000 });
    const directions = new URL(await page.getByRole("link", { name: "Navigate to job", exact: true }).getAttribute("href"));
    assert.equal(directions.searchParams.get("destination"), "1 Test Street, Chico, CA");
    assert.ok((await context.cookies()).some(c => c.name === "homeatlas-field-session" && c.httpOnly));
    assert.equal(await page.getByRole("link", { name: "HQ view", exact: true }).count(), 0);
    const ownerPage = await context.request.get(`${base}/hq/technicians`, { maxRedirects: 0 });
    assert.equal(ownerPage.status(), 307, "Technician session must not open HQ");
    assert.match(ownerPage.headers().location, /\/hq\?returnTo=/);
    await page.getByRole("button", { name: /I’m here · Start job/ }).click();
    await page.getByRole("button", { name: /Document finished work/ }).click();
    await page.getByLabel(/Exterior glass/).check();
    await page.getByLabel(/Work summary for HQ/).fill("Exterior glass cleaned.");
    await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "internal-rehearsal.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") });
    await page.getByRole("button", { name: "Save work & continue", exact: true }).click();
    await page.getByText(/Rehearsal connection interruption/).waitFor();
    assert.equal(await page.getByLabel(/Work summary for HQ/).inputValue(), "Exterior glass cleaned.");
    await page.getByRole("button", { name: "Save work & continue", exact: true }).click();
    await page.getByRole("button", { name: /Clock out & complete/ }).waitFor();
    if (process.env.EXPECT_CLOSEOUT_FIX === "1") await page.getByText("Work saved for HQ. After cleanup and pack-up, clock out to finish your visit.", { exact: true }).waitFor();
    const redundantCapture = await page.getByRole("button", { name: /Add visit memory/ }).count();
    console.log(JSON.stringify({ width, activated: true, closeoutRetry: true, redundantCaptureBeforeClockOut: redundantCapture }));
    if (process.env.EXPECT_CLOSEOUT_FIX === "1") assert.equal(redundantCapture, 0, "A saved native closeout must not offer another rejected submission");
    await page.getByRole("button", { name: /Clock out & complete/ }).click();
    await page.getByText("Job time saved", { exact: true }).waitFor();
    if (process.env.EXPECT_CLOSEOUT_FIX === "1") assert.equal(await page.getByRole("button", { name: /Add visit memory|Document this visit/ }).count(), 0);
    assert.equal(commits, 1);
    assert.equal(photoIntents, 1, "A commit retry must reuse completed photo uploads");
    assert.equal(photoUploads, 1, "A commit retry must not upload duplicate private photos");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(JSON.stringify({ width, clockOut: true, successfulCommits: commits, privatePhotoUploads: photoUploads, jobberCompletionUnchanged: !visit().isComplete }));
    await context.close();
  }
} catch (error) { console.error(serverLog); throw error; }
finally { await browser?.close(); next.kill(); db.closeAllConnections(); db.close(); }
