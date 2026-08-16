import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SALES_SESSION_COOKIE_NAME,
  hashSalesAccessToken,
  isCurrentSalesRepAccessGrant,
  isSalesAccessToken,
  issueOpaqueSalesToken,
  salesSessionTokenFromHeaders,
} from "./sales-access";
import {
  safeSalesReturnTo,
  salesAccessPath,
  salesReturnToForRep,
  salesWorkspacePath,
} from "./sales-access-paths";

describe("sales representative phone access", () => {
  it("issues 256-bit URL-safe opaque credentials and exposes only hashes", () => {
    const token = issueOpaqueSalesToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isSalesAccessToken(token)).toBe(true);
    expect(hashSalesAccessToken(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(hashSalesAccessToken(token)).not.toContain(token);
  });

  it("reads only a correctly formed sales session cookie", () => {
    const token = issueOpaqueSalesToken();
    expect(
      salesSessionTokenFromHeaders(
        new Headers({
          cookie: `other=1; ${SALES_SESSION_COOKIE_NAME}=${token}; last=yes`,
        }),
      ),
    ).toBe(token);
    expect(
      salesSessionTokenFromHeaders(
        new Headers({ cookie: `${SALES_SESSION_COOKIE_NAME}=short` }),
      ),
    ).toBeNull();
  });

  it("rejects malformed or padded token values", () => {
    expect(isSalesAccessToken("")).toBe(false);
    expect(isSalesAccessToken("a".repeat(42))).toBe(false);
    expect(isSalesAccessToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isSalesAccessToken("a".repeat(44))).toBe(false);
  });

  it("keeps install redirects on the narrow sales and presentation surface", () => {
    expect(salesWorkspacePath("david")).toBe("/david");
    expect(salesWorkspacePath("Noah")).toBe("/sales/noah");
    expect(safeSalesReturnTo("//example.com", "/david")).toBe("/david");
    expect(safeSalesReturnTo("/hq/billing", "/david")).toBe("/david");
    expect(safeSalesReturnTo("/presentations/new?rep=david", "/david")).toBe(
      "/presentations/new?rep=david",
    );
    expect(salesReturnToForRep("/sales/noah", "david")).toBe("/david");
    expect(salesReturnToForRep("/david", "noah")).toBe("/sales/noah");
    expect(
      salesAccessPath({ returnTo: "/david", repSlug: "david" }),
    ).toContain("rep=david");
  });

  it("does not present expired or revoked phone passes as current", () => {
    const reference = new Date("2026-08-16T18:00:00.000Z");
    const base = {
      id: "grant-1",
      repId: "rep-1",
      inviteExpiresAt: "2026-08-16T19:00:00.000Z",
      sessionExpiresAt: null,
      claimedAt: null,
      revokedAt: null,
      createdAt: "2026-08-16T17:00:00.000Z",
    };

    expect(
      isCurrentSalesRepAccessGrant({ ...base, status: "pending" }, reference),
    ).toBe(true);
    expect(
      isCurrentSalesRepAccessGrant(
        {
          ...base,
          status: "pending",
          inviteExpiresAt: "2026-08-16T17:59:59.000Z",
        },
        reference,
      ),
    ).toBe(false);
    expect(
      isCurrentSalesRepAccessGrant(
        {
          ...base,
          status: "active",
          claimedAt: "2026-08-16T17:10:00.000Z",
          sessionExpiresAt: "2026-09-16T18:00:00.000Z",
        },
        reference,
      ),
    ).toBe(true);
    expect(
      isCurrentSalesRepAccessGrant(
        {
          ...base,
          status: "pending",
          revokedAt: "2026-08-16T17:30:00.000Z",
        },
        reference,
      ),
    ).toBe(false);
  });
});
