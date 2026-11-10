// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsignedEnrollmentRevision } from "@/components/enrollment/unsigned-enrollment-revision";
import type { EnrollmentPacketStatusSnapshot } from "./types";
vi.mock("@/lib/admin/api-client", () => ({ getAdminRequestHeaders: () => ({ "Content-Type": "application/json" }) }));
const packet: EnrollmentPacketStatusSnapshot = {
  status: "signature_sent", paymentRail: "stripe_card", updatedAt: "2026-01-01",
  unsignedRevision: { expectedTokenSha256: "a".repeat(64), expectedPresentationUpdatedAt: "2026-01-01", tier: "biannual",
    firstVisitPrice: 714, recurringVisitPrice: 714, annualizedValue: 1428, salesContext: "remote", homeSolicitationNoticeDays: null,
    signatureProvider: "homeatlas_native", signerName: "Separate signer", signerEmail: "signer@example.com", recipientEmail: "signer@example.com" },
};
let container: HTMLDivElement; let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(value = packet, onSent = vi.fn()) {
  await act(async () => root.render(React.createElement(UnsignedEnrollmentRevision, { presentationId: "presentation", packet: value, onSent })));
  return onSent;
}
async function confirm() {
  const textarea = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Include gutters on both visits");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
}
describe("HQ unsigned revision UI", () => {
  it("renders nothing without the server-provided HQ capability", async () => {
    await render({ ...packet, unsignedRevision: undefined }); expect(container.textContent).toBe("");
  });
  it("requires reason and confirmation, preserves saved fields, and blocks duplicate clicks", async () => {
    let resolve!: (value: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((done) => { resolve = done; })); vi.stubGlobal("fetch", fetchMock);
    const onSent = await render(); const button = container.querySelector("button")!;
    expect(button.disabled).toBe(true); expect(container.textContent).toContain("714.00"); expect(container.textContent).toContain("1428.00");
    await confirm(); expect(button.disabled).toBe(false);
    await act(async () => { button.click(); button.click(); });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(button.disabled).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ action: "revise_unsigned_native", firstVisitPrice: 714, annualizedValue: 1428, signerEmail: "signer@example.com", paymentRail: "stripe_card", expectedPresentationUpdatedAt: "2026-01-01" });
    await act(async () => resolve({ ok: true, json: async () => ({ status: "signature_sent" }) })); expect(onSent).toHaveBeenCalledTimes(1);
  });
  it("keeps ambiguous failure locked and asks for delivery review", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection lost")));
    await render(); await confirm(); await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector("button")!.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("delivery history");
  });
});
