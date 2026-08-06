import type { PresentationData } from "./types";
import { restorePresentationDraftPayload } from "./draft-persistence";

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

/**
 * Prefer a newer in-tab draft over the server copy. This recovers edits after
 * a refresh or navigation without allowing an older browser cache to replace
 * a presentation that was updated elsewhere.
 */
export function freshestPresentation(
  server: PresentationData,
  cached: PresentationData | null,
): PresentationData {
  if (!cached || cached.id !== server.id) return server;

  const serverUpdatedAt = Date.parse(server.updatedAt);
  const cachedUpdatedAt = Date.parse(cached.updatedAt);
  if (!Number.isFinite(cachedUpdatedAt)) return server;
  if (!Number.isFinite(serverUpdatedAt) || cachedUpdatedAt > serverUpdatedAt) {
    return {
      ...restorePresentationDraftPayload(server, cached),
      updatedAt: cached.updatedAt,
    };
  }

  return server;
}

export function clearCachedPresentation(id: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    // ignore
  }
}
