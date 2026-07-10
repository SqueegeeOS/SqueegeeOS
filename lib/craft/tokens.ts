/** Shared class recipes for the HomeAtlas craftsmanship layer. */

export const craftEyebrow =
  "text-[10px] uppercase tracking-[0.28em] text-muted";

/** Accent eyebrow — stage/state context lines. Same scale as craftEyebrow. */
export const craftEyebrowAccent =
  "text-[10px] uppercase tracking-[0.28em] text-accent";

/** Form and field labels — label above value. */
export const craftLabel =
  "mb-2 block text-[10px] uppercase tracking-[0.24em] text-muted";

/** Read-only field label in workspace rows. */
export const craftFieldLabel =
  "text-[10px] uppercase tracking-[0.16em] text-muted/80";

/** Metric and date values — tabular, foreground. */
export const craftValue =
  "text-base font-medium tabular-nums text-foreground sm:text-lg";

/** Table header type — <th>/<tr> typography only; borders stay per-table. */
export const craftTableHead =
  "text-[10px] uppercase tracking-[0.2em] text-muted";

export const craftHeading =
  "font-serif font-light tracking-[-0.015em] text-foreground [text-wrap:balance]";

export const craftBody =
  "text-sm leading-relaxed text-foreground/75 sm:text-[0.9375rem] sm:leading-[1.65]";

export const craftInput =
  "w-full rounded-[1.1rem] border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-foreground outline-none backdrop-blur-sm placeholder:text-muted/45 transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus:border-accent/35 focus:bg-white/[0.045] focus:shadow-[0_0_0_1px_rgba(201,184,150,0.1),0_8px_24px_rgba(0,0,0,0.18)]";

export const craftTextarea =
  "w-full resize-none rounded-[1.1rem] border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-foreground outline-none backdrop-blur-sm placeholder:text-muted/45 transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus:border-accent/35 focus:bg-white/[0.045] focus:shadow-[0_0_0_1px_rgba(201,184,150,0.1),0_8px_24px_rgba(0,0,0,0.18)]";

export const craftPrimaryButton =
  "craft-btn-primary inline-flex min-h-[52px] items-center justify-center rounded-full border border-accent/25 bg-accent px-6 text-sm font-medium tracking-[0.1em] text-[var(--on-accent)] shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_12px_32px_rgba(0,0,0,0.28)] transition-[transform,opacity,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-95 active:scale-[0.985] active:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_6px_18px_rgba(0,0,0,0.22)] disabled:opacity-45 disabled:active:scale-100";

export const craftSecondaryButton =
  "craft-btn-secondary inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] px-5 text-xs font-medium uppercase tracking-[0.14em] text-foreground/90 shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-sm transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-accent/30 hover:bg-white/[0.06] active:scale-[0.985]";

export const craftGhostLink =
  "text-xs text-muted underline underline-offset-[3px] transition-colors duration-300 hover:text-accent";

export const craftGlassSurface =
  "craft-glass rounded-[var(--radius-card)] shadow-[var(--shadow-float)]";

export const craftGlassElevated =
  "craft-glass-elevated rounded-[var(--radius-card-lg)] shadow-[var(--shadow-lift)]";

export const craftGlassInset = "craft-glass-inset";
