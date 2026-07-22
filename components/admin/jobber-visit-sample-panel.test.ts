import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./jobber-visit-sample-panel.tsx", import.meta.url),
  "utf8",
);

describe("Jobber visit sample property-link revocation", () => {
  it("carries the exact reviewed link ID and version in every revoke command", () => {
    expect(source).toContain(
      'linkId: action === "revoke" ? visit.propertyLink?.linkId : undefined',
    );
    expect(source).toContain(
      "expectedLinkUpdatedAt: visit.propertyLink?.updatedAt ?? null",
    );
    expect(source).toMatch(
      /visit\.propertyLink\?\.linkState === "active"[\s\S]*?writePropertyLink\(visit, "revoke"\)/,
    );
  });

  it("contains no UI fallback that reports an absent link as a revoke success", () => {
    expect(source).not.toMatch(/already_jobber_only|already Jobber-only/i);
  });
});
