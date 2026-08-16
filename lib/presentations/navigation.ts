export interface PresentationNavigationTarget {
  id: string;
  status?: string | null;
}

export function presentationWorkspacePath(
  presentation: PresentationNavigationTarget,
): string {
  const presentationId = encodeURIComponent(presentation.id);
  return presentation.status === "signed"
    ? `/presentations/${presentationId}/present`
    : `/presentations/${presentationId}/edit`;
}
