import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const migration = read("../persistence/supabase/migrations/20260909070000_technician_labor_photo_memory.sql");
const timeServer = read("./technician-manual-time-server.ts");
const profileServer = read("./technician-profile-server.ts");
const photoServer = read("../field-records/technician-photo-memory-server.ts");
const overlay = read("../../components/admin/technician-evidence-overlay.tsx");
const page = read("../../app/hq/technicians/[technicianId]/page.tsx");

describe("technician labor and property-memory contract", () => {
  it("keeps owner-entered labor separate, private, and auditable", () => {
    expect(migration).toContain("homeatlas_technician_manual_time_entries");
    expect(migration).toContain("homeatlas_technician_manual_time_voids");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
    expect(timeServer).toContain("Keep manual time separate from verified clock evidence");
    expect(profileServer).toContain("manualMinutes");
    expect(profileServer).toContain("recordedMinutes");
  });

  it("finds missed clocks and checks complete before/after field evidence", () => {
    expect(profileServer).toContain("timeRepairCandidates");
    expect(profileServer).toContain('photo.captureType === "before"');
    expect(profileServer).toContain('photo.captureType === "after"');
    expect(profileServer).toContain("workdayIntegrity");
    expect(overlay).toContain("Did the day leave a clean trail?");
    expect(overlay).toContain("Add missed hours");
  });

  it("keeps native photos private until a linked member passes owner review", () => {
    expect(photoServer).toContain("memberLinked");
    expect(photoServer).toContain("Link this Jobber property to a HomeAtlas member before publishing the photo");
    expect(photoServer).toContain('category: "visit"');
    expect(photoServer).toContain('photo_source: "our_team"');
    expect(photoServer).toContain('input.photo.capture_type === "after"');
    expect(migration).toContain("homeatlas_technician_photo_publication_events");
    expect(overlay).toContain("Publish to member · cover eligible");
  });

  it("surfaces the mobile evidence workspace without replacing live dispatch", () => {
    expect(page).toContain("<TechnicianLiveDispatchOverlay");
    expect(page).toContain("<TechnicianEvidenceOverlay");
    expect(overlay).toContain("Hours &amp; proof");
    expect(overlay).toContain("SqueegeeKing history kept in Atlas");
  });
});
