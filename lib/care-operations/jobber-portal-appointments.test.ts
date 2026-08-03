import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildJobberPortalAppointmentValues,
  buildJobberPortalTimeWindow,
  jobberVisitAppointmentStatus,
  selectNearestUpcomingJobberVisit,
  type JobberPortalVisitCandidate,
} from "./jobber-portal-appointments";

function visit(
  overrides: Partial<JobberPortalVisitCandidate> = {},
): JobberPortalVisitCandidate {
  return {
    id: "projection-1",
    external_visit_id: "visit-1",
    external_job_id: "job-1",
    external_client_id: "client-1",
    external_property_id: "jobber-property-1",
    title: "Window care",
    visit_status: "UPCOMING",
    is_complete: false,
    scheduled_start: "2026-08-12T16:00:00.000Z",
    scheduled_end: "2026-08-12T18:00:00.000Z",
    completed_at: null,
    source_observed_at: "2026-07-30T18:00:00.000Z",
    source_payload_hash: "payload-hash-1",
    ...overrides,
  };
}

describe("Jobber member portal appointment projection", () => {
  it("selects the nearest future scheduled visit", () => {
    const nearest = selectNearestUpcomingJobberVisit(
      [
        visit({
          external_visit_id: "past",
          scheduled_start: "2026-07-20T16:00:00.000Z",
        }),
        visit({
          external_visit_id: "later",
          scheduled_start: "2026-09-01T16:00:00.000Z",
        }),
        visit({
          external_visit_id: "cancelled",
          visit_status: "CANCELLED",
          scheduled_start: "2026-08-01T16:00:00.000Z",
        }),
        visit({
          external_visit_id: "nearest",
          scheduled_start: "2026-08-05T16:00:00.000Z",
        }),
      ],
      new Date("2026-07-30T00:00:00.000Z"),
    );
    expect(nearest?.external_visit_id).toBe("nearest");
  });

  it("maps Jobber terminal states without leaving stale scheduled visits", () => {
    expect(
      jobberVisitAppointmentStatus({ visit_status: "NO_SHOW", is_complete: true }),
    ).toBe("no_show");
    expect(
      jobberVisitAppointmentStatus({ visit_status: "CANCELLED", is_complete: false }),
    ).toBe("cancelled");
    expect(
      jobberVisitAppointmentStatus({ visit_status: "REMOVED", is_complete: false }),
    ).toBe("cancelled");
    expect(
      jobberVisitAppointmentStatus({ visit_status: "COMPLETED", is_complete: true }),
    ).toBe("completed");
  });

  it("shows the Jobber service window in Pacific business time", () => {
    expect(
      buildJobberPortalTimeWindow(
        "2026-08-12T16:00:00.000Z",
        "2026-08-12T18:00:00.000Z",
      ),
    ).toBe("9:00 AM–11:00 AM");
  });

  it("creates provider truth without overwriting a later billing binding", () => {
    const values = buildJobberPortalAppointmentValues({
      visit: visit(),
      memberProfileId: "member-profile-1",
      propertyId: "property-1",
    });
    expect(values).toMatchObject({
      member_profile_id: "member-profile-1",
      property_id: "property-1",
      service_type: "Window care",
      scheduled_at: "2026-08-12T16:00:00.000Z",
      status: "scheduled",
      provider: "jobber",
      external_id: "visit-1",
      provenance_state: "provider_imported",
      verification_state: "verified",
      match_state: "matched",
    });
    expect(values).not.toHaveProperty("matched_obligation_id");
  });

  it("reconciles after both a confirmed customer pair and every visit sync", () => {
    const pairing = readFileSync(
      new URL("./jobber-customer-matching.ts", import.meta.url),
      "utf8",
    );
    const visitSync = readFileSync(
      new URL("./jobber-visit-sync.ts", import.meta.url),
      "utf8",
    );
    expect(pairing).toContain("reconcilePairedCustomerPortalVisit");
    expect(visitSync).toContain("reconcileAllPairedCustomerPortalVisits");
  });

  it("projects every exactly matched visit at an active paired property", () => {
    const source = readFileSync(
      new URL("./jobber-portal-appointments.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('.from("jobber_property_links")');
    expect(source).toContain('.eq("link_state", "active")');
    expect(source).toContain('.eq("match_state", "matched")');
    expect(source).toContain(
      '.eq("matched_property_id", input.target.member.property.id)',
    );
    expect(source).toContain(
      "eligibleExternalVisitIds.has(appointment.external_id)",
    );
    expect(source).toContain(
      'if (existing?.link_state === "revoked") return null',
    );
    expect(source).not.toContain('.eq("link_state", "revoked")\n    .select');
  });
});
