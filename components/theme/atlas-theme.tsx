"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ATLAS_THEMES,
  ATLAS_THEME_STORAGE_KEY,
  DEFAULT_ATLAS_THEME,
  isAtlasThemeId,
  type AtlasThemeId,
} from "@/lib/theme/atlas-themes";

interface AtlasThemeContextValue {
  theme: AtlasThemeId;
  setTheme: (theme: AtlasThemeId) => void;
}

const AtlasThemeContext = createContext<AtlasThemeContextValue | null>(null);

/**
 * Scoped theme provider for customer-facing surfaces. Sets
 * data-atlas-theme on its wrapper; the theme's CSS variable overrides
 * in globals.css re-skin everything inside. Night is the SSR default,
 * so first paint always matches the classic portal.
 */
export function AtlasThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AtlasThemeId>(DEFAULT_ATLAS_THEME);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ATLAS_THEME_STORAGE_KEY);
      if (isAtlasThemeId(stored)) setThemeState(stored);
    } catch {
      // storage unavailable (private mode) — stay on default
    }
  }, []);

  const setTheme = useCallback((next: AtlasThemeId) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(ATLAS_THEME_STORAGE_KEY, next);
    } catch {
      // non-persistent is fine
    }
  }, []);

  return (
    <AtlasThemeContext.Provider value={{ theme, setTheme }}>
      <div data-atlas-theme={theme} className="contents">
        {children}
      </div>
    </AtlasThemeContext.Provider>
  );
}

export function useAtlasTheme(): AtlasThemeContextValue {
  const ctx = useContext(AtlasThemeContext);
  if (!ctx) {
    return { theme: DEFAULT_ATLAS_THEME, setTheme: () => undefined };
  }
  return ctx;
}

/** The social moment: Day / Night / Lux, one tap each. */
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
                ? "bg-accent text-background"
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
