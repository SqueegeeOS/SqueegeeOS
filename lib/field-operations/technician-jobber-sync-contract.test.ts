import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("technician Jobber force-sync boundary", () => {
  it("requires a technician Field Pass and performs read-only visit refresh", () => {
    const route = read("app/api/field/jobber-sync/route.ts");

    expect(route).toContain("authorizeFieldRequest");
    expect(route).toContain('actor.kind !== "technician"');
    expect(route).toContain("syncAllJobberVisits()");
    expect(route).toContain("reconcilePendingLiveDispatchJobs()");
    expect(route).not.toContain("syncAllJobberData");
    expect(route).not.toContain("billing");
    expect(route).not.toContain("Stripe");
  });

  it("exposes one-tap sync only inside the technician Field Run", () => {
    const page = read("app/tech/page.tsx");
    const button = read("components/field/technician-jobber-sync-button.tsx");

    expect(page).toContain('actor.kind === "technician"');
    expect(page).toContain("TechnicianJobberSyncButton");
    expect(button).toContain('fetch("/api/field/jobber-sync"');
    expect(button).toContain("Sync Jobber");
    expect(button).toContain("window.location.reload()");
  });
});
