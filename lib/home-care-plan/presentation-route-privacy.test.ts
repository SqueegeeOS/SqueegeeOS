import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("opaque Home Care Plan route privacy", () => {
  it("emits noindex, nofollow metadata and response headers", async () => {
    const page = readFileSync(
      resolve(
        process.cwd(),
        "app/homecare/[homeownerSlug]/[propertySlug]/plan/[planId]/page.tsx",
      ),
      "utf8",
    );
    expect(page).toContain("robots: { index: false, follow: false }");

    const rules = (await nextConfig.headers?.()) ?? [];
    const capabilityRule = rules.find(
      (rule) =>
        rule.source ===
        "/homecare/:homeownerSlug/:propertySlug/plan/:planId",
    );
    expect(capabilityRule?.headers).toEqual(
      expect.arrayContaining([
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ]),
    );
  });
});
