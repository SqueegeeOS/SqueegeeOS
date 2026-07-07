const STORAGE_KEY = "hq_requests_inbox_last_opened_at";

export function getRequestsInboxLastOpenedAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function markRequestsInboxOpened(at = new Date().toISOString()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, at);
}

export function hasUnreadRequests(
  newCount: number,
  latestNewSubmittedAt: string | null,
  lastOpenedAt: string | null,
): boolean {
  if (newCount <= 0 || !latestNewSubmittedAt) return false;
  if (!lastOpenedAt) return true;
  return new Date(latestNewSubmittedAt) > new Date(lastOpenedAt);
}
