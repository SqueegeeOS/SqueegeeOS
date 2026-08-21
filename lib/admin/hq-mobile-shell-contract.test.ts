import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("HQ mobile shell", () => {
  it("contains wide HQ content without disabling browser zoom", () => {
    const rootLayout = read("../../app/layout.tsx");
    const hqLayout = read("../../app/hq/layout.tsx");
    const globals = read("../../app/globals.css");

    expect(rootLayout).toContain('width: "device-width"');
    expect(rootLayout).toContain("initialScale: 1");
    expect(rootLayout).not.toContain("maximumScale");
    expect(rootLayout).not.toContain("userScalable");
    expect(hqLayout).toContain("hq-mobile-shell");
    expect(globals).toContain("overscroll-behavior-x: none");
    expect(globals).toContain("overflow-x: clip");
  });

  it("prevents iOS form focus from auto-zooming the HQ viewport", () => {
    const globals = read("../../app/globals.css");

    expect(globals).toContain("@media (max-width: 767px)");
    expect(globals).toContain(
      ".hq-mobile-shell :is(input, select, textarea)",
    );
    expect(globals).toContain("font-size: 16px");
  });
});
