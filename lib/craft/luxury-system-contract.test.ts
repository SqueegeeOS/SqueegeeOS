import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const globalStyles = read("../../app/globals.css");
const tokens = read("./tokens.ts");
const technicianLayout = read("../../app/tech/layout.tsx");
const technicianAccess = read("../../app/tech/access/page.tsx");
const salesAccess = read("../../app/sales/access/page.tsx");
const technicianDock = read(
  "../../components/field/technician-portal-dock.tsx",
);
const technicianToday = read(
  "../../components/field/technician-today-workspace.tsx",
);

describe("HomeAtlas luxury system contract", () => {
  it("defines semantic operational colors, geometry, and motion", () => {
    expect(globalStyles).toContain("--status-success:");
    expect(globalStyles).toContain("--status-warning:");
    expect(globalStyles).toContain("--status-danger:");
    expect(globalStyles).toContain("--radius-control:");
    expect(globalStyles).toContain("--ease-premium:");
    expect(globalStyles).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps field and sales access on one shared entry surface", () => {
    expect(technicianAccess).toContain("<AccessFrame");
    expect(salesAccess).toContain("<AccessFrame");
    expect(technicianAccess).toContain("<StatusNotice");
    expect(salesAccess).toContain("<StatusNotice");
    expect(tokens).toContain("craftPrimaryButton");
  });

  it("uses the HomeAtlas role shell and semantic accent in the field workspace", () => {
    expect(technicianLayout).toContain("atlas-role-shell");
    expect(technicianDock).toContain("border-accent/35");
    expect(technicianToday).toContain("<StatePanel");
    expect(technicianToday).toContain("<StatusNotice");
    expect(
      [technicianLayout, technicianAccess, technicianDock, technicianToday].join(
        "\n",
      ),
    ).not.toMatch(/#(?:9be2bd|a8ebc8|08100d|111615|d5f8e4|bff1d5|c9f3dc)/i);
  });
});
