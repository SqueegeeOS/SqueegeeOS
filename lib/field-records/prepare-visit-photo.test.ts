// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareVisitPhoto } from "./prepare-visit-photo";
import { MAX_VISIT_PHOTO_BYTES } from "./visit-field-record";

function photo(size: number, type = "image/jpeg", name = "camera.jpg") {
  const file = new File([new Uint8Array(size)], name, { type });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(size) });
  return file;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("local photo preparation (synthetic bytes only)", () => {
  it("copies a small JPEG without decoding, resizing, or changing its bytes", async () => {
    const bytes = new Uint8Array([255, 216, 255, 217]);
    const file = new File([bytes], "small.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
    const decode = vi.fn(); vi.stubGlobal("createImageBitmap", decode);
    const result = await prepareVisitPhoto(file, "image/jpeg");
    const actual = await new Promise<ArrayBuffer>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(result); });
    expect(new Uint8Array(actual)).toEqual(bytes);
    expect(result).not.toBe(file);
    expect(result.type).toBe("image/jpeg");
    expect(decode).not.toHaveBeenCalled();
  });
  it("resizes large photos to JPEG below the unchanged storage limit and closes bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 8000, height: 6000, close }));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback) {
      expect(this.width).toBe(2560); expect(this.height).toBe(1920);
      callback(new Blob([new Uint8Array(100)], { type: "image/jpeg" }));
    });
    const result = await prepareVisitPhoto(photo(MAX_VISIT_PHOTO_BYTES + 1, "image/png", "camera.png"), "image/png");
    expect(result.name).toBe("camera.jpg"); expect(result.type).toBe("image/jpeg"); expect(result.size).toBe(100);
    expect(drawImage).toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  });
  it("preserves supported original when browser decoding fails, but rejects oversized originals", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported codec")));
    const result = await prepareVisitPhoto(photo(3 * 1024 * 1024), "image/jpeg");
    expect(result.size).toBe(3 * 1024 * 1024);
    await expect(prepareVisitPhoto(photo(MAX_VISIT_PHOTO_BYTES + 1), "image/jpeg")).rejects.toThrow("still over 15 MB");
  });
  it("keeps HEIC bytes and MIME intact without attempting conversion", async () => {
    const decode = vi.fn(); vi.stubGlobal("createImageBitmap", decode);
    const result = await prepareVisitPhoto(photo(3 * 1024 * 1024, "", "phone.HEIC"), "image/heic");
    expect(result.type).toBe("image/heic"); expect(result.name).toBe("phone.HEIC");
    expect(decode).not.toHaveBeenCalled();
  });
  it("rejects a partial provider read before upload", async () => {
    const file = photo(20);
    Object.defineProperty(file, "size", { value: 40 });
    await expect(prepareVisitPhoto(file, "image/jpeg")).rejects.toThrow("could not read the photo");
  });
});
