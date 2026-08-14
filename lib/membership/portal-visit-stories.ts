import type { PropertyPhotoView } from "@/lib/member-intelligence/types";
import type { ServiceObservationView } from "@/lib/persistence/queries/member-portal";

export interface PortalVisitStory {
  id: string;
  fieldRecordId: string;
  observedAt: string;
  observedBy: string | null;
  note: string | null;
  photos: PropertyPhotoView[];
}

export interface PortalVisitStoryCollection {
  stories: PortalVisitStory[];
  ungroupedObservations: ServiceObservationView[];
  ungroupedPhotos: PropertyPhotoView[];
}

const CAPTURE_ORDER: Record<NonNullable<PropertyPhotoView["captureType"]>, number> = {
  before: 0,
  after: 1,
  detail: 2,
};

function photoOrder(photo: PropertyPhotoView): number {
  return photo.captureType ? CAPTURE_ORDER[photo.captureType] : 3;
}

function latestIso(values: string[]): string {
  return values.reduce(
    (latest, value) => (value.localeCompare(latest) > 0 ? value : latest),
    values[0]!,
  );
}

export function buildPortalVisitStories(
  observations: ServiceObservationView[],
  photos: PropertyPhotoView[],
): PortalVisitStoryCollection {
  const groupedObservations = new Map<string, ServiceObservationView[]>();
  const groupedPhotos = new Map<string, PropertyPhotoView[]>();

  for (const observation of observations) {
    if (!observation.fieldRecordId) continue;
    const group = groupedObservations.get(observation.fieldRecordId) ?? [];
    group.push(observation);
    groupedObservations.set(observation.fieldRecordId, group);
  }

  for (const photo of photos) {
    if (!photo.fieldRecordId) continue;
    const group = groupedPhotos.get(photo.fieldRecordId) ?? [];
    group.push(photo);
    groupedPhotos.set(photo.fieldRecordId, group);
  }

  const fieldRecordIds = new Set([
    ...groupedObservations.keys(),
    ...groupedPhotos.keys(),
  ]);
  const stories = [...fieldRecordIds]
    .map((fieldRecordId): PortalVisitStory => {
      const storyObservations = groupedObservations.get(fieldRecordId) ?? [];
      const storyPhotos = [...(groupedPhotos.get(fieldRecordId) ?? [])].sort(
        (left, right) =>
          photoOrder(left) - photoOrder(right) ||
          left.uploadedAt.localeCompare(right.uploadedAt),
      );
      const primaryObservation = storyObservations.toSorted((left, right) =>
        right.observedAt.localeCompare(left.observedAt),
      )[0];
      const observedAt = primaryObservation?.observedAt ??
        latestIso(storyPhotos.map((photo) => photo.uploadedAt));

      return {
        id: `visit-story-${fieldRecordId}`,
        fieldRecordId,
        observedAt,
        observedBy:
          primaryObservation?.observedBy ??
          storyPhotos.find((photo) => photo.capturedBy)?.capturedBy ??
          null,
        note: primaryObservation?.notes.trim() || null,
        photos: storyPhotos,
      };
    })
    .toSorted((left, right) => right.observedAt.localeCompare(left.observedAt));

  return {
    stories,
    ungroupedObservations: observations.filter(
      (observation) => !observation.fieldRecordId,
    ),
    ungroupedPhotos: photos.filter((photo) => !photo.fieldRecordId),
  };
}
