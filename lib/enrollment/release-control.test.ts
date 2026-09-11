import { describe, expect, it } from "vitest";
import {
  getEnrollmentRecipientGate,
  getEnrollmentReleaseControlState,
} from "./release-control";

describe("enrollment release control", () => {
  it("allows an explicit owner live release without claiming a completed rehearsal", () => {
    const config = { releaseMode: "live", rehearsalEmail: "", rehearsalConfirmed: "false", liveApproved: "true" };
    expect(getEnrollmentReleaseControlState(config)).toMatchObject({ ready: true, rehearsalConfirmed: false, missing: [] });
    expect(getEnrollmentRecipientGate("customer@example.com", config).allowed).toBe(true);
    expect(getEnrollmentRecipientGate("invalid", config).allowed).toBe(false);
    expect(getEnrollmentRecipientGate("customer@example.com", { ...config, releaseMode: "rehearsal", rehearsalEmail: "owner@example.com" }).allowed).toBe(false);
    expect(getEnrollmentReleaseControlState({ ...config, releaseMode: "invalid" }).ready).toBe(false);
    expect(getEnrollmentRecipientGate("customer@example.com", { ...config, liveApproved: "false" }).allowed).toBe(false);
  });
  it("defaults to fail-closed rehearsal mode", () => {
    const state = getEnrollmentReleaseControlState({
      releaseMode: "",
      rehearsalEmail: "",
      rehearsalConfirmed: "",
    });

    expect(state).toMatchObject({
      mode: "rehearsal",
      ready: false,
      rehearsalRecipientConfigured: false,
    });
    expect(state.missing).toContain("HOMEATLAS_ENROLLMENT_REHEARSAL_EMAIL");
  });

  it("permits only the normalized business-owned address during rehearsal", () => {
    const config = {
      releaseMode: "rehearsal",
      rehearsalEmail: " Owner@Example.com ",
      rehearsalConfirmed: "false",
    };

    expect(getEnrollmentRecipientGate("owner@example.com", config).allowed).toBe(
      true,
    );
    expect(getEnrollmentRecipientGate("customer@example.com", config)).toMatchObject(
      { allowed: false, mode: "rehearsal" },
    );
  });

  it("requires an explicit successful rehearsal before live recipients", () => {
    const unconfirmed = {
      releaseMode: "live",
      rehearsalEmail: "owner@example.com",
      rehearsalConfirmed: "false",
    };
    const confirmed = { ...unconfirmed, rehearsalConfirmed: "true" };

    expect(getEnrollmentRecipientGate("customer@example.com", unconfirmed).allowed).toBe(
      false,
    );
    expect(getEnrollmentRecipientGate("customer@example.com", confirmed).allowed).toBe(
      true,
    );
  });

  it("fails closed for invalid modes and never exposes the full allowlisted address", () => {
    const invalid = getEnrollmentReleaseControlState({
      releaseMode: "anything-goes",
      rehearsalEmail: "private-owner@example.com",
      rehearsalConfirmed: "true",
    });

    expect(invalid.ready).toBe(false);
    expect(invalid.missing).toContain("HOMEATLAS_ENROLLMENT_RELEASE_MODE");
    expect(JSON.stringify(invalid)).not.toContain("private-owner@example.com");
    expect(invalid.rehearsalRecipientHint).toBe("pr***@example.com");
  });
});
