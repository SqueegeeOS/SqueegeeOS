/** HomeAtlas experience themes — same portal, different atmosphere. */

export type AtlasThemeId = "day" | "night" | "lux";

export const ATLAS_THEMES: Array<{
  id: AtlasThemeId;
  label: string;
  tagline: string;
}> = [
  { id: "day", label: "Day", tagline: "Bright, calm, everyday" },
  { id: "night", label: "Night", tagline: "Cinematic stewardship" },
  { id: "lux", label: "Lux", tagline: "Private estate" },
];

export const DEFAULT_ATLAS_THEME: AtlasThemeId = "night";
/** Readable default for member portal when no saved preference exists. */
export const PORTAL_DEFAULT_ATLAS_THEME: AtlasThemeId = "lux";
export const ATLAS_THEME_STORAGE_KEY = "atlas-theme";

export function isAtlasThemeId(value: unknown): value is AtlasThemeId {
  return value === "day" || value === "night" || value === "lux";
}
