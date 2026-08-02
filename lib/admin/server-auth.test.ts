import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE_NAME,
  authorizeAdminRequest,
  getAdminAccessMode,
  issueAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/admin/server-auth";

const original = {
  ADMIN_PIN: process.env.ADMIN_PIN,
  ADMIN_PRIVATE_BETA: process.env.ADMIN_PRIVATE_BETA,
};

function clearAdminEnvironment() {
  delete process.env.ADMIN_PIN;
  delete process.env.NEXT_PUBLIC_ADMIN_PIN;
  delete process.env.ADMIN_PRIVATE_BETA;
}

beforeEach(clearAdminEnvironment);

afterEach(() => {
  clearAdminEnvironment();
  for (const [key, value] of Object.entries(original)) {
    if (value !== undefined) process.env[key] = value;
  }
});

describe("admin server authorization", () => {
  it("fails closed when no access mode is configured", () => {
    expect(getAdminAccessMode()).toBeNull();
    expect(authorizeAdminRequest(null)).toBe(false);
    expect(authorizeAdminRequest("anything")).toBe(false);
    expect(issueAdminSessionToken()).toBeNull();
  });

  it("verifies the server-only PIN and an expiring signed session", () => {
    process.env.ADMIN_PIN = "583104";
    const now = 1_800_000_000_000;

    expect(getAdminAccessMode()).toBe("pin");
    expect(authorizeAdminRequest("583104")).toBe(true);
    expect(authorizeAdminRequest("583105")).toBe(false);

    const token = issueAdminSessionToken(now);
    expect(token).toBeTruthy();
    expect(verifyAdminSessionToken(token, now + 1_000)).toBe(true);
    expect(verifyAdminSessionToken(token, now + 8 * 60 * 60 * 1_000)).toBe(
      false,
    );
    expect(verifyAdminSessionToken(`${token}tampered`, now + 1_000)).toBe(false);

    const currentToken = issueAdminSessionToken();
    const sessionHeaders = new Headers({
      cookie: `${ADMIN_SESSION_COOKIE_NAME}=${currentToken}`,
    });
    expect(authorizeAdminRequest(sessionHeaders)).toBe(true);

    sessionHeaders.set(
      "cookie",
      `${ADMIN_SESSION_COOKIE_NAME}=${currentToken}tampered`,
    );
    expect(authorizeAdminRequest(sessionHeaders)).toBe(false);
  });

  it("never accepts the browser-exposed legacy PIN variable", () => {
    process.env.NEXT_PUBLIC_ADMIN_PIN = "legacy-pin";
    expect(authorizeAdminRequest("legacy-pin")).toBe(false);
    expect(getAdminAccessMode()).toBeNull();
  });

  it("opens private beta only when explicitly enabled", () => {
    process.env.ADMIN_PRIVATE_BETA = "true";
    expect(getAdminAccessMode()).toBe("beta");
    expect(authorizeAdminRequest(null)).toBe(true);
    expect(verifyAdminSessionToken(null)).toBe(true);
  });
});
