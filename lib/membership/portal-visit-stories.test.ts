import { describe, expect, it } from "vitest";
import type { PropertyPhotoView } from "@/lib/member-intelligence/types";
import type { ServiceObservationView } from "@/lib/persistence/queries/member-portal";
import { buildPortalVisitStories } from "@/lib/membership/portal-visit-stories";

function observation(
  id: string,
  fieldRecordId: string | null,
  observedAt = "2026-08-14T12:00:00.000Z",
): ServiceObservationView {
  return {
    id,
    fieldRecordId,
    observedAt,
    observedBy: "Noah",
    notes: "Glass cleaned and inspected.",
    category: "visit_update",
    severity: null,
  };
}

function photo(
  id: string,
  fieldRecordId: string | null,
  captureType: PropertyPhotoView["captureType"],
  uploadedAt = "2026-08-14T18:00:00.000Z",
): PropertyPhotoView {
  return {
    id,
    fieldRecordId,
    source: "our_team",
    url: `https://example.test/${id}.jpg`,
    caption: `${captureType ?? "Visit"} service`,
    isPrimary: false,
    uploadedAt,
    captureType,
    capturedBy: "Noah",
  };
}

describe("portal visit stories", () => {
  it("keeps one Today note with its ordered before and after proof", () => {
    const result = buildPortalVisitStories(
      [observation("note-1", "record-1")],
      [
        photo("after-1", "record-1", "after"),
        photo("before-1", "record-1", "before"),
      ],
    );

    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]).toMatchObject({
      fieldRecordId: "record-1",
      observedBy: "Noah",
      note: "Glass cleaned and inspected.",
    });
    expect(result.stories[0]?.photos.map((item) => item.captureType)).toEqual([
      "before",
      "after",
    ]);
    expect(result.ungroupedObservations).toEqual([]);
    expect(result.ungroupedPhotos).toEqual([]);
  });

  it("keeps a photo-only field record as customer-visible proof", () => {
    const result = buildPortalVisitStories(
      [],
      [photo("detail-1", "record-2", "detail")],
    );

    expect(result.stories[0]).toMatchObject({
      fieldRecordId: "record-2",
      observedAt: "2026-08-14T18:00:00.000Z",
      observedBy: "Noah",
      note: null,
    });
  });

  it("preserves legacy notes and photos outside the grouped visit stories", () => {
    const legacyObservation = observation("legacy-note", null);
    const legacyPhoto = photo("legacy-photo", null, "detail");
    const result = buildPortalVisitStories(
      [legacyObservation],
      [legacyPhoto],
    );

    expect(result.stories).toEqual([]);
    expect(result.ungroupedObservations).toEqual([legacyObservation]);
    expect(result.ungroupedPhotos).toEqual([legacyPhoto]);
  });

  it("orders the newest connected visit first", () => {
    const result = buildPortalVisitStories(
      [
        observation("older", "record-old", "2026-07-01T12:00:00.000Z"),
        observation("newer", "record-new", "2026-08-14T12:00:00.000Z"),
      ],
      [],
    );

    expect(result.stories.map((story) => story.fieldRecordId)).toEqual([
      "record-new",
      "record-old",
    ]);
  });
});
