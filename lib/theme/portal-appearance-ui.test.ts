// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasThemeProvider, PortalThemeSelector } from "@/components/theme/atlas-theme";
import { PortalStage } from "@/components/portal/portal-stage";
import PortalEntryPage from "@/app/portal/page";
import { portalThemeStorageKey } from "@/lib/theme/portal-theme-persistence";

const { replace, readStoredPortalToken } = vi.hoisted(() => ({
  replace: vi.fn(),
  readStoredPortalToken: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/lib/pwa/portal-session", () => ({ readStoredPortalToken }));
vi.mock("@/components/portal/portal-loading-screen", () => ({
  PortalLoadingScreen: () => createElement("p", null, "Opening portal"),
}));

let root: Root;
let container: HTMLDivElement;
const request = vi.fn();

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  localStorage.clear();
  replace.mockReset();
  readStoredPortalToken.mockReset().mockReturnValue(null);
  request.mockReset().mockRejectedValue(new Error("Unexpected network call"));
  vi.stubGlobal("fetch", request);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderSelector(portalToken: string | null = null) {
  await act(async () => root.render(createElement(AtlasThemeProvider, {
    savedTheme: "night", membershipId: "test-member", portalToken,
  } as ComponentProps<typeof AtlasThemeProvider>, createElement(PortalThemeSelector))));
}

async function choose(value: string) {
  const radio = container.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
  await act(async () => radio.click());
}

async function save() {
  await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
}

describe("portal appearance polish (HTTP and session access mocked)", () => {
  it("keeps appearance below care content and collapsed initially", async () => {
    await act(async () => root.render(createElement(PortalStage, {
      savedTheme: "day",
    } as ComponentProps<typeof PortalStage>, createElement("h1", null, "Care record"))));
    expect(container.querySelector("details")!.open).toBe(false);
    expect(container.querySelector("summary")!.textContent).toBe("Portal appearance");
    expect(container.innerHTML.indexOf("Care record")).toBeLessThan(container.innerHTML.indexOf("Portal appearance"));
    expect(container.textContent).toContain("Home care by SqueegeeKing");
  });

  it("uses labelled native radios and preserves the three existing choices", async () => {
    await renderSelector();
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.map((radio) => radio.value)).toEqual(["day", "night", "lux"]);
    expect(radios.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(["night"]);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    expect(container.querySelector("legend")!.textContent).toBe("Choose your appearance");
    for (const radio of radios) expect(radio.closest("label")!.textContent?.trim()).not.toBe("");
  });

  it("previews without persistence, then saves only on the explicit action", async () => {
    await renderSelector();
    await choose("day");
    expect(container.querySelector('[data-atlas-theme="day"]')).not.toBeNull();
    expect(localStorage.getItem(portalThemeStorageKey("test-member"))).toBeNull();
    expect(request).not.toHaveBeenCalled();
    await save();
    expect(localStorage.getItem(portalThemeStorageKey("test-member"))).toBe("day");
    expect(container.querySelector('[role="status"]')!.textContent).toContain("preference is saved");
    expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  });

  it("locks repeated saves and theme changes until the mocked cloud save settles", async () => {
    let finish!: (response: Response) => void;
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    await renderSelector("test-token");
    await choose("lux");
    await save();
    await save();
    expect(request).toHaveBeenCalledTimes(1);
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).every((radio) => radio.disabled)).toBe(true);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ theme: "lux", token: "test-token" });
    await act(async () => finish(Response.json({ saved: true })));
    expect(container.querySelector('[role="status"]')!.textContent).toContain("preference is saved");
  });

  it("offers an accessible retry after an interrupted save", async () => {
    request.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(Response.json({ saved: true }));
    await renderSelector("test-token");
    await choose("day");
    await save();
    expect(container.querySelector('[role="status"]')!.textContent).toContain("could not be saved");
    expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false);
    await save();
    expect(request).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')!.textContent).toContain("preference is saved");
  });

  it("adds help and home links without creating a new authentication flow", async () => {
    await act(async () => root.render(createElement(PortalEntryPage)));
    expect(container.querySelector("h1")!.textContent).toBe("Open your portal link");
    expect(container.querySelector('a[href="/contact"]')!.textContent).toBe("Get portal help");
    expect(container.querySelector('a[href="tel:+15305886235"]')).not.toBeNull();
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("preserves automatic navigation for an existing stored portal link", async () => {
    readStoredPortalToken.mockReturnValue("test-token");
    await act(async () => root.render(createElement(PortalEntryPage)));
    expect(replace).toHaveBeenCalledWith("/portal/test-token");
    expect(container.textContent).toContain("Opening portal");
    expect(container.querySelector('a[href="/contact"]')).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

});
