import { describe, expect, it } from "vitest";
import { MAX_VISIT_PHOTO_BYTES } from "./visit-field-record";
import { resolveVisitPhotoMimeType, selectVisitPhotos, VISIT_PHOTO_ACCEPT } from "./visit-photo-selection";

const photo = (name = "IMG_1001.HEIC", type = "", size = 100) => ({ name, type, size });

describe("phone photo selection", () => {
  it.each([
    ["IMG_1001.HEIC", "", "image/heic"],
    ["before.JPG", "application/octet-stream", "image/jpeg"],
    ["after.jpeg", "image/jpg", "image/jpeg"],
    ["photo.png", "image/png", "image/png"],
    ["photo.heif", "", "image/heif"],
  ])("recognizes %s with browser type %s", (name, type, expected) => {
    expect(resolveVisitPhotoMimeType(photo(name, type))).toBe(expected);
  });

  it("does not accept unsupported types by renaming them", () => {
    expect(resolveVisitPhotoMimeType(photo("photo.jpg", "application/pdf"))).toBeNull();
    expect(resolveVisitPhotoMimeType(photo("movie.mov", ""))).toBeNull();
    expect(resolveVisitPhotoMimeType(photo("photo.constructor", ""))).toBeNull();
    expect(resolveVisitPhotoMimeType(photo("jpg", ""))).toBeNull();
    expect(resolveVisitPhotoMimeType(photo("script.svg", "image/svg+xml"))).toBeNull();
  });

  it("keeps valid selections when other files are invalid or exceed remaining capacity", () => {
    const selection = selectVisitPhotos([
      photo("empty.jpg", "image/jpeg", 0),
      photo("large.jpg", "image/jpeg", MAX_VISIT_PHOTO_BYTES + 1),
      photo("before.heic"), photo("after.jpg"), photo("extra.jpg"),
    ], 6);
    expect(selection.accepted.map(({ file }) => file.name)).toEqual(["before.heic", "after.jpg"]);
    expect(selection.errors).toHaveLength(3);
    expect(selection.errors[2]).toContain("Save these, then add another update");
  });

  it("accepts the exact size boundary and leaves cancellation empty", () => {
    expect(selectVisitPhotos([photo("photo.jpg", "image/jpeg", MAX_VISIT_PHOTO_BYTES)], 0).accepted).toHaveLength(1);
    expect(selectVisitPhotos([], 2)).toEqual({ accepted: [], errors: [] });
    expect(VISIT_PHOTO_ACCEPT).toContain(".heic");
  });
});
