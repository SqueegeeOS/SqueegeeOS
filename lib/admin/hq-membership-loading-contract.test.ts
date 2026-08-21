import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("HQ membership loading experience", () => {
  it("covers both the route transition and the client-side customer fetch", () => {
    const routeLoading = read(
      "../../app/hq/customers/[type]/[id]/loading.tsx",
    );
    const workspace = read(
      "../../components/admin/customer-workspace-page.tsx",
    );

    expect(routeLoading).toContain("<PortalLoadingScreen />");
    expect(workspace).toContain("if (loading)");
    expect(workspace).toContain("return <PortalLoadingScreen />");
    expect(workspace).not.toContain("Loading workspace…");
  });

  it("covers the tokenless portal entry route", () => {
    const portalLoading = read("../../app/portal/loading.tsx");
    const portalEntry = read("../../app/portal/page.tsx");

    expect(portalLoading).toContain("<PortalLoadingScreen />");
    expect(portalEntry).toContain("return <PortalLoadingScreen />");
  });
});
