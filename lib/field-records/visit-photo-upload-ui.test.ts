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
  Object.defineProperty(value, "arrayBuffer", { value: async () => new ArrayBuffer(16) });
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
