import { describe, expect, it } from "vitest";
import {
  jobberTodayVisitAnchorId,
  technicianFieldPassAnchorId,
} from "./jobber-today-links";

describe("Jobber Today links", () => {
  it("creates matching, URL-safe visit and Field Pass anchors", () => {
    expect(jobberTodayVisitAnchorId("visit:123/abc")).toBe(
      "visit-visit-123-abc",
    );
    expect(technicianFieldPassAnchorId("user:alex/1")).toBe(
      "field-pass-user-alex-1",
    );
  });

  it("uses a stable fallback and bounds untrusted fragment input", () => {
    expect(jobberTodayVisitAnchorId("   ")).toBe("visit-unknown");
    expect(technicianFieldPassAnchorId("!")).toBe("field-pass-unknown");
    expect(jobberTodayVisitAnchorId("a".repeat(500))).toHaveLength(186);
  });
});
