import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../${path}`, import.meta.url)),
    "utf8",
  );
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .match(/[\da-f]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);

  return (lighter + 0.05) / (darker + 0.05);
}

describe("member portal Day theme contrast", () => {
  it("uses an AA-contrast Day accent for small text and accent controls", () => {
    const css = readProjectFile("app/globals.css");
    const dayTheme = css.match(
      /\[data-atlas-theme="day"\]\s*\{([\s\S]*?)\n\}/,
    )?.[1];
    const background = dayTheme?.match(/--background:\s*(#[\da-f]{6})/i)?.[1];
    const accent = dayTheme?.match(/--accent:\s*(#[\da-f]{6})/i)?.[1];

    expect(background).toBeDefined();
    expect(accent).toBeDefined();
    expect(contrastRatio(accent!, background!)).toBeGreaterThanOrEqual(4.5);
    expect(dayTheme).toContain("--on-accent: #fffdf8;");
  });

  it("keeps portal journey text on theme-aware foreground tokens", () => {
    const journey = readProjectFile(
      "components/membership/homeatlas-journey-section.tsx",
    );

    expect(journey).not.toMatch(/(?:text|border|via)-white/);
    expect(journey).toContain("text-foreground");
    expect(journey).toContain("text-muted");
    expect(journey).toContain("border-border");
  });

  it("keeps payment setup copy and controls theme-aware", () => {
    const paymentSetup = [
      readProjectFile("components/membership/card-on-file-setup.tsx"),
      readProjectFile("components/membership/stripe-payment-setup.tsx"),
    ].join("\n");

    expect(paymentSetup).not.toMatch(
      /(?:text|border|placeholder:text|hover:border|hover:text)-white/,
    );
    expect(paymentSetup).toContain("placeholder:text-muted");
    expect(paymentSetup).toContain("hover:border-accent/30");
  });
});
