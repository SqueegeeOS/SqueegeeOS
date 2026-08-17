export const FIELD_WORKSPACE_REFRESH_INTERVAL_MS = 90_000;

export function shouldAutoRefreshFieldWorkspace(input: {
  isOnline: boolean;
  visibilityState: string;
}): boolean {
  return input.isOnline && input.visibilityState === "visible";
}

export function fieldWorkspaceSyncLabel(
  generatedAt: string | null,
  reference: Date = new Date(),
): string {
  if (!generatedAt) return "Sync pending";
  const generated = new Date(generatedAt).getTime();
  const referenceTime = reference.getTime();
  if (!Number.isFinite(generated) || !Number.isFinite(referenceTime)) {
    return "Sync time unavailable";
  }

  const elapsed = referenceTime - generated;
  if (elapsed < -5 * 60_000) return "Sync time unavailable";
  if (elapsed < 60_000) return "Synced just now";

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `Synced ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `Synced ${hours}h ago`;
}
