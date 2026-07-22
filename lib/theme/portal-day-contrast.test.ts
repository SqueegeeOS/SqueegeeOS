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

const PRE_0951_CLASSES_BY_FILE: Record<
  string,
  ReadonlyArray<readonly [originalClasses: string, semanticHook: string]>
> = {
  "components/membership/card-on-file-setup.tsx": [
    ["mt-1 text-sm text-foreground/50", "portal-payment-copy"],
  ],
  "components/membership/homeatlas-journey-section.tsx": [
    ["border-y border-white/[0.06] py-12 sm:py-14", "portal-journey-ledger"],
    [
      "text-[10px] font-medium uppercase tracking-[0.22em] text-white/35",
      "portal-journey-label",
    ],
    [
      "mt-3 font-serif text-[1.625rem] font-light leading-snug tracking-[-0.01em] text-white/[0.88] sm:text-3xl",
      "portal-journey-value",
    ],
    [
      "mt-14 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent",
      "portal-journey-divider",
    ],
    [
      "text-[10px] font-medium uppercase tracking-[0.28em] text-accent/55",
      "portal-journey-eyebrow",
    ],
    [
      "mt-4 font-serif text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-white/[0.92] sm:text-4xl",
      "portal-journey-heading",
    ],
    [
      "mt-5 max-w-md text-sm leading-[1.7] text-white/45",
      "portal-journey-copy",
    ],
  ],
  "components/membership/member-portal-experience.tsx": [
    [
      "mt-6 inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-amber-100/90",
      "portal-pending-payment-badge",
    ],
  ],
  "components/membership/stripe-payment-setup.tsx": [
    ["text-sm text-white/45", "portal-payment-copy"],
    [
      "rounded-lg border border-white/15 px-5 py-3.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white/80 disabled:opacity-40",
      "portal-payment-back-button",
    ],
    ["text-sm text-white/50", "portal-payment-loading"],
  ],
};

const DAY_HOOKS = [
  ...new Set(
    Object.values(PRE_0951_CLASSES_BY_FILE).flatMap((entries) =>
      entries.map(([, hook]) => hook),
    ),
  ),
];

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

function mixHex(foreground: string, background: string, amount: number): string {
  const channels = [1, 3, 5].map((offset) => {
    const foregroundChannel = Number.parseInt(
      foreground.slice(offset, offset + 2),
      16,
    );
    const backgroundChannel = Number.parseInt(
      background.slice(offset, offset + 2),
      16,
    );

    return Math.round(
      foregroundChannel * amount + backgroundChannel * (1 - amount),
    )
      .toString(16)
      .padStart(2, "0");
  });

  return `#${channels.join("")}`;
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
    expect(atmospheres.Day.accent).toBe("#84683f");

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

  it("pins the pre-0951 Night and Lux classes with semantic hooks appended", () => {
    for (const [path, entries] of Object.entries(PRE_0951_CLASSES_BY_FILE)) {
      const source = readProjectFile(path);

      for (const [originalClasses, semanticHook] of entries) {
        expect(source, `${path} ${semanticHook}`).toContain(
          `${originalClasses} ${semanticHook}`,
        );
      }
    }

    const memberPortal = readProjectFile(
      "components/membership/member-portal-experience.tsx",
    );
    const pendingPaymentStart = memberPortal.indexOf("{view.pendingPayment && (");
    const pendingPaymentBlock = memberPortal.slice(
      pendingPaymentStart,
      pendingPaymentStart + 500,
    );

    expect(pendingPaymentStart).toBeGreaterThanOrEqual(0);
    expect(pendingPaymentBlock).toContain("portal-pending-payment-badge");
  });

  it("keeps every semantic hook override scoped to Day", () => {
    const css = readProjectFile("app/globals.css");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

    for (const hook of DAY_HOOKS) {
      const hookSelectors = rules.flatMap((rule) =>
        rule[1]
          .split(",")
          .map((selector) => selector.trim())
          .filter((selector) => selector.includes(`.${hook}`)),
      );

      expect(hookSelectors, hook).not.toHaveLength(0);
      expect(hookSelectors, hook).toSatisfy((selectors: string[]) =>
        selectors.every((selector) =>
          selector.startsWith('[data-atlas-theme="day"]'),
        ),
      );
    }
  });

  it("keeps Day hook text and the pending badge at AA contrast", () => {
    const css = readProjectFile("app/globals.css");
    const night = parseEffectiveThemeTokens(css, ":root");
    const day = parseEffectiveThemeTokens(
      css,
      '[data-atlas-theme="day"]',
      night,
    );
    const pendingBadge = readCssBlock(
      css,
      '[data-atlas-theme="day"] .portal-pending-payment-badge',
    );

    expect(contrastRatio(day.foreground, day.background)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(day.muted, day.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(day.accent, day.background)).toBeGreaterThanOrEqual(4.5);
    expect(pendingBadge).toContain(
      "background-color: color-mix(in srgb, var(--accent) 3%, transparent);",
    );
    expect(
      contrastRatio(day.accent, mixHex(day.accent, day.background, 0.03)),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
