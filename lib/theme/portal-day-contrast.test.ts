import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../${path}`, import.meta.url)),
    "utf8",
  );
}

const THEME_TOKEN_NAMES = ["background", "foreground", "muted", "accent"] as const;
const TEXT_TOKEN_NAMES = ["foreground", "muted", "accent"] as const;

type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];
type ThemeTokens = Record<ThemeTokenName, string>;

const EXPECTED_NIGHT_TOKENS: ThemeTokens = {
  background: "#070605",
  foreground: "#f5f2eb",
  muted: "#8a8680",
  accent: "#c9b896",
};

const EXPECTED_LUX_TOKENS: ThemeTokens = {
  background: "#090705",
  foreground: "#f3ecdc",
  muted: "#9c8f76",
  accent: "#d4af37",
};

function readCssBlock(css: string, selector: string): string {
  const opening = `${selector} {`;
  const start = css.indexOf(opening);
  const end = css.indexOf("\n}", start + opening.length);

  if (start === -1 || end === -1) {
    throw new Error(`Could not find CSS block for ${selector}`);
  }

  return css.slice(start + opening.length, end);
}

function parseEffectiveThemeTokens(
  css: string,
  selector: string,
  inherited: Partial<ThemeTokens> = {},
): ThemeTokens {
  const block = readCssBlock(css, selector);
  const tokens: Partial<ThemeTokens> = { ...inherited };

  for (const token of THEME_TOKEN_NAMES) {
    const value = block.match(
      new RegExp(`--${token}:\\s*(#[\\da-f]{6})\\s*;`, "i"),
    )?.[1];

    if (value) {
      tokens[token] = value.toLowerCase();
    }
  }

  for (const token of THEME_TOKEN_NAMES) {
    if (!tokens[token]) {
      throw new Error(`Missing effective --${token} token for ${selector}`);
    }
  }

  return tokens as ThemeTokens;
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

describe("member portal atmosphere contrast", () => {
  it("keeps shared text tokens AA across Night, Day, and Lux", () => {
    const css = readProjectFile("app/globals.css");
    const night = parseEffectiveThemeTokens(css, ":root");
    const atmospheres: Record<"Night" | "Day" | "Lux", ThemeTokens> = {
      Night: night,
      Day: parseEffectiveThemeTokens(css, '[data-atlas-theme="day"]', night),
      Lux: parseEffectiveThemeTokens(css, '[data-atlas-theme="lux"]', night),
    };

    expect(atmospheres.Night).toEqual(EXPECTED_NIGHT_TOKENS);
    expect(atmospheres.Lux).toEqual(EXPECTED_LUX_TOKENS);

    for (const [atmosphere, tokens] of Object.entries(atmospheres)) {
      for (const token of TEXT_TOKEN_NAMES) {
        expect(
          contrastRatio(tokens[token], tokens.background),
          `${atmosphere} --${token} contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }

    expect(readCssBlock(css, '[data-atlas-theme="day"]')).toContain(
      "--on-accent: #fffdf8;",
    );
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
