import type { PresentationData } from "./types";

const STORAGE_PREFIX = "squeegee:presentation:";

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

export function cachePresentation(data: PresentationData): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(data.id), JSON.stringify(data));
  } catch {
    // Private browsing or quota — ignore.
  }
}

export function readCachedPresentation(id: string): PresentationData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as PresentationData;
  } catch {
    return null;
  }
}

export function clearCachedPresentation(id: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    // ignore
  }
}
