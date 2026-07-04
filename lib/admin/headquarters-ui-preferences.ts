/** UI-only preferences cached in localStorage — never founder or legacy data. */

export const HQ_UI_PREFS_KEY = "squeegeeking:hq-ui-preferences";

export interface HeadquartersUiPreferences {
  sidebarCollapsed: boolean;
  theme: "system" | "light" | "dark";
  dismissedBanners: string[];
  recentTabs: string[];
}

export const DEFAULT_HQ_UI_PREFERENCES: HeadquartersUiPreferences = {
  sidebarCollapsed: false,
  theme: "system",
  dismissedBanners: [],
  recentTabs: [],
};

export function loadHeadquartersUiPreferences(): HeadquartersUiPreferences {
  if (typeof window === "undefined") return DEFAULT_HQ_UI_PREFERENCES;

  const raw = localStorage.getItem(HQ_UI_PREFS_KEY);
  if (!raw) return DEFAULT_HQ_UI_PREFERENCES;

  try {
    return { ...DEFAULT_HQ_UI_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_HQ_UI_PREFERENCES;
  }
}

export function saveHeadquartersUiPreferences(
  patch: Partial<HeadquartersUiPreferences>,
): HeadquartersUiPreferences {
  const next = { ...loadHeadquartersUiPreferences(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(HQ_UI_PREFS_KEY, JSON.stringify(next));
  }
  return next;
}
