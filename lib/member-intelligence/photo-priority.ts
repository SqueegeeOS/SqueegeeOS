import type { PropertyPhotoView } from "./types";

const PLACEHOLDER_HOME = "/placeholder-home.jpg";

/**
 * Photo priority: our team → Zillow → member upload → placeholder.
 */
export function getPrimaryPhoto(photos: PropertyPhotoView[]): string {
  const ourPhoto = photos.find((p) => p.source === "our_team" && p.isPrimary);
  if (ourPhoto?.url) return ourPhoto.url;

  const ourAny = photos.find((p) => p.source === "our_team");
  if (ourAny?.url) return ourAny.url;

  const zillowPrimary = photos.find((p) => p.source === "zillow" && p.isPrimary);
  if (zillowPrimary?.url) return zillowPrimary.url;

  const zillowAny = photos.find((p) => p.source === "zillow");
  if (zillowAny?.url) return zillowAny.url;

  const memberPhoto = photos.find((p) => p.source === "member_uploaded");
  if (memberPhoto?.url) return memberPhoto.url;

  return PLACEHOLDER_HOME;
}

export function sortPhotosByPriority(photos: PropertyPhotoView[]): PropertyPhotoView[] {
  const rank: Record<PropertyPhotoView["source"], number> = {
    our_team: 0,
    zillow: 1,
    member_uploaded: 2,
    internal: 3,
  };

  return [...photos].sort((a, b) => {
    const bySource = rank[a.source] - rank[b.source];
    if (bySource !== 0) return bySource;
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return b.uploadedAt.localeCompare(a.uploadedAt);
  });
}
