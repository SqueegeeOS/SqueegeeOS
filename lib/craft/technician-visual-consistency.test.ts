import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surfaces = [
  "components/admin/technician-access-page.tsx", "components/admin/technician-readiness-panel.tsx",
  "components/admin/technician-capacity-panel.tsx", "components/admin/technician-dispatch-board.tsx",
  "components/field/technician-today-workspace.tsx", "components/field/technician-referral-form.tsx", "app/tech/refer/page.tsx",
];
describe("shared technician visual foundation", () => {
  it("uses semantic palette colors rather than independent color swatches", () => {
    for (const path of surfaces) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(/(?:text|bg|border|accent)-\[#[0-9a-f]+\]/i);
      expect(source, path).not.toMatch(/(?:text|bg|border)-(?:emerald|amber|red|white)-?\d*\//);
    }
  });
  it("inherits the same theme as HQ and reuses shared actions", () => {
    expect(readFileSync("app/tech/layout.tsx", "utf8")).not.toContain('data-atlas-theme="lux"');
    expect(readFileSync("components/admin/technician-access-page.tsx", "utf8")).toContain("craftPrimaryButton");
    expect(readFileSync("components/field/technician-referral-form.tsx", "utf8")).toContain("craftPrimaryButton");
    expect(readFileSync("app/tech/access/page.tsx", "utf8")).toContain("AccessFrame");
  });
});
