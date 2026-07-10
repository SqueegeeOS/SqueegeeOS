"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ATLAS_THEMES,
  DEFAULT_ATLAS_THEME,
  isAtlasThemeId,
  type AtlasThemeId,
} from "@/lib/theme/atlas-themes";
import {
  resolvePortalThemePreference,
  writePortalThemeToStorage,
} from "@/lib/theme/portal-theme-persistence";

export interface AtlasThemeProviderProps {
  children: ReactNode;
  /** Server-persisted theme from memberships.portal_theme */
  savedTheme?: AtlasThemeId | null;
  membershipId?: string | null;
  portalToken?: string | null;
  homeownerSlug?: string | null;
  propertySlug?: string | null;
}

interface AtlasThemeContextValue {
  theme: AtlasThemeId;
  savedTheme: AtlasThemeId;
  setTheme: (theme: AtlasThemeId) => void;
  saveTheme: () => Promise<boolean>;
  isDirty: boolean;
  isSaving: boolean;
  canPersist: boolean;
}

const AtlasThemeContext = createContext<AtlasThemeContextValue | null>(null);

/**
 * Scoped theme provider for customer-facing surfaces. Sets
 * data-atlas-theme on its wrapper; the theme's CSS variable overrides
 * in globals.css re-skin everything inside.
 */
export function AtlasThemeProvider({
  children,
  savedTheme = null,
  membershipId = null,
  portalToken = null,
  homeownerSlug = null,
  propertySlug = null,
}: AtlasThemeProviderProps) {
  const resolvedSaved = useMemo(
    () => resolvePortalThemePreference(savedTheme, membershipId),
    [savedTheme, membershipId],
  );

  const [theme, setThemeState] = useState<AtlasThemeId>(resolvedSaved);
  const [persistedTheme, setPersistedTheme] =
    useState<AtlasThemeId>(resolvedSaved);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const next = resolvePortalThemePreference(savedTheme, membershipId);
    setThemeState(next);
    setPersistedTheme(next);
  }, [savedTheme, membershipId]);

  const setTheme = useCallback((next: AtlasThemeId) => {
    setThemeState(next);
  }, []);

  const canPersist = Boolean(membershipId || portalToken || (homeownerSlug && propertySlug));

  const saveTheme = useCallback(async (): Promise<boolean> => {
    writePortalThemeToStorage(theme, membershipId);

    if (!canPersist) {
      setPersistedTheme(theme);
      return true;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/portal/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          token: portalToken ?? undefined,
          homeownerSlug: homeownerSlug ?? undefined,
          propertySlug: propertySlug ?? undefined,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { saved?: boolean };
      if (data.saved === false) {
        // Column missing or cloud unavailable — localStorage still holds preference
        setPersistedTheme(theme);
        return true;
      }

      setPersistedTheme(theme);
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    theme,
    membershipId,
    portalToken,
    homeownerSlug,
    propertySlug,
    canPersist,
  ]);

  const value = useMemo(
    () => ({
      theme,
      savedTheme: persistedTheme,
      setTheme,
      saveTheme,
      isDirty: theme !== persistedTheme,
      isSaving,
      canPersist,
    }),
    [theme, persistedTheme, setTheme, saveTheme, isSaving, canPersist],
  );

  return (
    <AtlasThemeContext.Provider value={value}>
      <div data-atlas-theme={theme} className="contents">
        {children}
      </div>
    </AtlasThemeContext.Provider>
  );
}

export function useAtlasTheme(): AtlasThemeContextValue {
  const ctx = useContext(AtlasThemeContext);
  if (!ctx) {
    return {
      theme: DEFAULT_ATLAS_THEME,
      savedTheme: DEFAULT_ATLAS_THEME,
      setTheme: () => undefined,
      saveTheme: async () => false,
      isDirty: false,
      isSaving: false,
      canPersist: false,
    };
  }
  return ctx;
}

/** Preview Day / Night / Lux with explicit save for persistence. */
export function PortalThemeSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme, saveTheme, isDirty, isSaving } = useAtlasTheme();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  const handleSave = useCallback(async () => {
    const ok = await saveTheme();
    setSaveState(ok ? "saved" : "error");
    window.setTimeout(() => setSaveState("idle"), 2400);
  }, [saveTheme]);

  return (
    <div
      className={`flex w-full max-w-md flex-col items-center gap-3 ${className}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted">
        HomeAtlas Atmosphere
      </p>
      <div
        role="radiogroup"
        aria-label="Portal atmosphere"
        className="inline-flex w-full items-center gap-1 rounded-full border border-[var(--at-toggle-border,rgba(245,242,235,0.14))] bg-[var(--at-toggle-bg,rgba(245,242,235,0.05))] p-1 backdrop-blur-sm"
      >
        {ATLAS_THEMES.map((t) => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={t.tagline}
              onClick={() => setTheme(t.id)}
              className={`min-h-[34px] flex-1 rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors duration-300 touch-manipulation sm:px-4 sm:tracking-[0.16em] ${
                active
                  ? "bg-accent text-[var(--on-accent)]"
                  : "text-foreground/55 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!isDirty || isSaving}
        className="min-h-[36px] rounded-full border border-border bg-[var(--glass-bg-elevated)] px-5 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/75 transition-[opacity,background-color,border-color] duration-300 hover:border-accent/30 hover:text-foreground disabled:cursor-default disabled:opacity-40 touch-manipulation"
      >
        {isSaving
          ? "Saving…"
          : saveState === "saved"
            ? "Saved"
            : saveState === "error"
              ? "Try again"
              : isDirty
                ? "Save atmosphere"
                : "Atmosphere saved"}
      </button>
    </div>
  );
}

/** @deprecated Use PortalThemeSelector in customer portal surfaces. */
export function AtlasThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useAtlasTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Portal theme"
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--at-toggle-border,rgba(245,242,235,0.14))] bg-[var(--at-toggle-bg,rgba(245,242,235,0.05))] p-1 backdrop-blur-sm ${className}`}
    >
      {ATLAS_THEMES.map((t) => {
        const active = t.id === theme;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={t.tagline}
            onClick={() => setTheme(t.id)}
            className={`min-h-[34px] rounded-full px-4 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors duration-300 touch-manipulation ${
              active
                ? "bg-accent text-[var(--on-accent)]"
                : "text-foreground/55 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
