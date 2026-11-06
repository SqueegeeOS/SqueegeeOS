"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useId,
  useState,
  type ReactNode,
} from "react";
import {
  ATLAS_THEMES,
  DEFAULT_ATLAS_THEME,
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

  const canPersist = Boolean(portalToken);

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
  const groupName = useId();

  const handleSave = useCallback(async () => {
    const ok = await saveTheme();
    setSaveState(ok ? "saved" : "error");
    window.setTimeout(() => setSaveState("idle"), 2400);
  }, [saveTheme]);

  return (
    <div
      className={`flex w-full max-w-md flex-col items-center gap-3 ${className}`}
    >
      <fieldset className="w-full">
        <legend className="mb-3 text-sm font-medium text-foreground">
          Choose your appearance
        </legend>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--at-toggle-border)] bg-[var(--at-toggle-bg)] p-1.5">
          {ATLAS_THEMES.map((t) => {
            const active = t.id === theme;
            return (
              <label key={t.id} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={groupName}
                  value={t.id}
                  checked={active}
                  disabled={isSaving}
                  onChange={() => {
                    setTheme(t.id);
                    setSaveState("idle");
                  }}
                  className="peer sr-only"
                />
                <span
                  className={`flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-wait ${
                    active
                      ? "bg-accent text-[var(--on-accent)]"
                      : "text-foreground hover:bg-accent/10"
                  }`}
                >
                  {t.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p role="status" className="min-h-5 w-full text-sm leading-relaxed text-muted">
        {saveState === "error"
          ? "Your preference could not be saved. Please try again."
          : saveState === "saved"
            ? "Your appearance preference is saved."
            : isDirty
              ? "Previewing this appearance. Save to keep it."
              : "Preview a style, then save your preference."}
      </p>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!isDirty || isSaving}
        className="min-h-11 self-start rounded-full border border-border bg-[var(--glass-bg-elevated)] px-5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-50 touch-manipulation"
      >
        {isSaving ? "Saving…" : "Save appearance"}
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
