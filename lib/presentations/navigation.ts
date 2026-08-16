export interface PresentationNavigationTarget {
  id: string;
  status?: string | null;
}

export interface PresentationNavigationOptions {
  returnTo?: unknown;
}

const SALES_WORKSPACE_PATH_PATTERN =
  /^\/sales\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRESENTATION_ID_PATTERN =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/**
 * Keeps presentation handoffs inside a private field desk. Never accept an
 * arbitrary return URL here: these values can arrive through the query string.
 */
export function fieldWorkspaceReturnPath(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  if (normalized === "/david") return normalized;
  return SALES_WORKSPACE_PATH_PATTERN.test(normalized) ? normalized : null;
}

export function presentationCloseReference(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  return PRESENTATION_ID_PATTERN.test(normalized) ? normalized : null;
}

function withFieldReturnPath(path: string, returnTo: unknown): string {
  const safeReturnTo = fieldWorkspaceReturnPath(returnTo);
  if (!safeReturnTo) return path;
  return `${path}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function presentationEditorPath(
  presentationId: string,
  options: PresentationNavigationOptions = {},
): string {
  const path = `/presentations/${encodeURIComponent(presentationId)}/edit`;
  return withFieldReturnPath(path, options.returnTo);
}

export function presentationPresentPath(
  presentationId: string,
  options: PresentationNavigationOptions = {},
): string {
  const path = `/presentations/${encodeURIComponent(presentationId)}/present`;
  return withFieldReturnPath(path, options.returnTo);
}

export function presentationWorkspacePath(
  presentation: PresentationNavigationTarget,
  options: PresentationNavigationOptions = {},
): string {
  return presentation.status === "signed"
    ? presentationPresentPath(presentation.id, options)
    : presentationEditorPath(presentation.id, options);
}

/**
 * After card setup, return a field-originated close to the exact rep desk and
 * carry only the presentation reference needed to verify the signed ledger.
 * Ordinary HQ presentations keep the existing editor destination.
 */
export function presentationCompletionPath(
  presentationId: string,
  returnTo: unknown,
): string {
  const safeReturnTo = fieldWorkspaceReturnPath(returnTo);
  if (!safeReturnTo) return presentationEditorPath(presentationId);

  const params = new URLSearchParams({ closedPresentation: presentationId });
  return `${safeReturnTo}?${params.toString()}#verified-closes`;
}
