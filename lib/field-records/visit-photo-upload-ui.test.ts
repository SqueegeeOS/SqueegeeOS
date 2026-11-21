// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VisitFieldCapture } from "@/components/visit/visit-field-capture";
import type { VisitPhotoDescriptor } from "./visit-field-record";

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: upload }) } }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: "a" }));

let root: Root;
let container: HTMLDivElement;
let requests: VisitPhotoDescriptor[][];
let commits: Array<{ photos: VisitPhotoDescriptor[] }>;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  localStorage.clear();
  Object.defineProperty(File.prototype, "arrayBuffer", { configurable: true, value: async function () { return new ArrayBuffer(this.size); } });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://photo-test.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fake-test-key");
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() }));
  requests = [];
  commits = [];
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    if (url.endsWith("/upload-intents")) {
      requests.push(body.photos);
      return Response.json({ bucket: "test", uploads: body.photos.map((photo: VisitPhotoDescriptor) => ({ ...photo, storagePath: `${photo.clientId}.jpg`, token: "fake-token" })) });
    }
    if (url.endsWith("/field-records")) {
      commits.push(body);
      return Response.json({ fieldRecordId: body.fieldRecordId, photoCount: body.photos.length });
    }
    throw new Error(`Unexpected test request: ${url}`);
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (File.prototype as unknown as { arrayBuffer?: unknown }).arrayBuffer;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function renderCapture() {
  await act(async () => root.render(createElement(VisitFieldCapture, {
    propertyId: "d1111111-1111-4111-8111-111111111111",
    appointmentId: "d2222222-2222-4222-8222-222222222222",
    clientName: "Test home", serviceLabel: "Test service", scopeItems: [], scopeReadState: "available",
    lockedTechnicianName: "Test technician", apiRoutePrefix: "/api/field",
  })));
}

function file(name: string, type = "image/jpeg") {
  const value = new File(["test image bytes"], name, { type });
  Object.defineProperty(value, "arrayBuffer", { configurable: true, value: async () => new ArrayBuffer(16) });
  return value;
}

async function choose(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

async function save() {
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("photo upload interaction (all storage and HTTP mocked)", () => {
  it("can select and save even when phone privacy settings deny localStorage access", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
    await renderCapture();
    await choose([file("arrival.jpg")]);
    await save();
    expect(commits).toHaveLength(1);
    expect(container.textContent).toContain("Visit record saved");
  });

  it("uploads camera-roll files without MIME and clears picker value for reselection", async () => {
    await renderCapture();
    await choose([file("arrival.HEIC", "")]);
    expect(container.textContent).toContain("1 before");
    expect(container.querySelector<HTMLInputElement>('input[type="file"]')!.value).toBe("");
    await save();
    expect(requests[0][0].mimeType).toBe("image/heic");
    expect(upload.mock.calls[0][2]).toBeInstanceOf(ArrayBuffer);
    expect(upload.mock.calls[0][3].contentType).toBe("image/heic");
    expect(commits).toHaveLength(1);
  });

  it("retries only unfinished photos and relabels uploaded photos without uploading again", async () => {
    upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "Connection interrupted" } }).mockResolvedValue({ error: null });
    await renderCapture();
    await choose([file("arrival.jpg"), file("finish.jpg")]);
    await save();
    expect(container.textContent).toContain("Connection interrupted");
    expect(container.querySelectorAll('li input[type="checkbox"]')).toHaveLength(2);
    const after = Array.from(container.querySelectorAll<HTMLButtonElement>("li button")).find((button) => button.textContent === "After")!;
    await act(async () => after.click());
    await save();
    expect(requests.map((photos) => photos.length)).toEqual([2, 1]);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(commits[0].photos.map((photo) => photo.captureType)).toEqual(["after", "before"]);
  });

  it("provides separate native library and camera inputs for each photo type", async () => {
    await renderCapture();
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    expect(inputs).toHaveLength(6);
    expect(inputs.every((input) => input.accept === "image/*")).toBe(true);
    expect(inputs.filter((input) => input.multiple).every((input) => !input.hasAttribute("capture"))).toBe(true);
    expect(inputs.filter((input) => input.getAttribute("capture") === "environment")).toHaveLength(3);
  });

  it("copies provider bytes during selection, not after provider access expires", async () => {
    await renderCapture();
    const original = file("provider.jpg");
    let reads = 0;
    Object.defineProperty(original, "arrayBuffer", { configurable: true, value: async () => {
      if (++reads > 1) throw new Error("Provider access expired");
      return new ArrayBuffer(original.size);
    } });
    await choose([original]);
    expect(reads).toBe(1);
    await save();
    expect(reads).toBe(1);
    expect(commits).toHaveLength(1);
  });

  it("keeps readable selections when one provider photo cannot be read", async () => {
    await renderCapture();
    const broken = file("cloud.jpg");
    Object.defineProperty(broken, "arrayBuffer", { configurable: true, value: async () => { throw new Error("provider failed"); } });
    await choose([broken, file("local.jpg")]);
    expect(container.textContent).toContain("Download it to this device");
    expect(container.textContent).toContain("1 before");
    await save();
    expect(commits[0].photos).toHaveLength(1);
  });

  it("prevents saving while a provider photo is being read", async () => {
    await renderCapture();
    let finishRead!: (value: ArrayBuffer) => void;
    const delayed = file("delayed.jpg");
    Object.defineProperty(delayed, "arrayBuffer", { configurable: true, value: () => new Promise<ArrayBuffer>((resolve) => { finishRead = resolve; }) });
    await choose([delayed]);
    expect(container.textContent).toContain("Preparing photos");
    await save();
    expect(requests).toHaveLength(0);
    await act(async () => finishRead(new ArrayBuffer(delayed.size)));
    await save();
    expect(commits).toHaveLength(1);
  });

  it("creates no preview URLs if preparation finishes after unmount", async () => {
    await renderCapture();
    let finishRead!: (value: ArrayBuffer) => void;
    const delayed = file("delayed.jpg");
    Object.defineProperty(delayed, "arrayBuffer", { configurable: true, value: () => new Promise<ArrayBuffer>((resolve) => { finishRead = resolve; }) });
    await choose([delayed]);
    await act(async () => root.unmount());
    await act(async () => finishRead(new ArrayBuffer(delayed.size)));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
  });

  it("shows provider guidance and no selected photos when the whole batch fails", async () => {
    await renderCapture();
    const broken = file("cloud.jpg");
    Object.defineProperty(broken, "arrayBuffer", { configurable: true, value: async () => { throw new Error("provider failed"); } });
    await choose([broken]);
    expect(container.textContent).toContain("Download it to this device");
    expect(container.textContent).toContain("0/8");
    expect(container.querySelector("fieldset")!.disabled).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("locks editing during upload and ignores repeated Save clicks", async () => {
    let finishUpload!: (value: { error: null }) => void;
    upload.mockImplementationOnce(() => new Promise((resolve) => { finishUpload = resolve; }));
    await renderCapture();
    await choose([file("arrival.jpg")]);
    await save();
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    expect(container.querySelector('input[type="file"]')!.matches(":disabled")).toBe(true);
    await save();
    expect(requests).toHaveLength(1);
    await act(async () => finishUpload({ error: null }));
    expect(commits).toHaveLength(1);
    expect(container.textContent).toContain("Visit record saved");
  });
});
