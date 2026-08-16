import { describe, expect, it } from "vitest";
import {
  fieldWorkspaceReturnPath,
  presentationCloseReference,
  presentationCompletionPath,
  presentationEditorPath,
  presentationPresentPath,
  presentationWorkspacePath,
} from "./navigation";

describe("presentation workspace navigation", () => {
  it("opens active drafts in the editor", () => {
    expect(
      presentationWorkspacePath({ id: "presentation-1", status: "draft" }),
    ).toBe("/presentations/presentation-1/edit");
  });

  it("opens an authoritative signed outcome in presentation mode", () => {
    expect(
      presentationWorkspacePath({ id: "presentation-2", status: "signed" }),
    ).toBe("/presentations/presentation-2/present");
  });

  it("encodes an unexpected identifier before building a route", () => {
    expect(presentationWorkspacePath({ id: "../another/path" })).toBe(
      "/presentations/..%2Fanother%2Fpath/edit",
    );
  });

  it("preserves an exact private field desk through edit and present mode", () => {
    expect(
      presentationEditorPath("presentation-1", { returnTo: "/david" }),
    ).toBe("/presentations/presentation-1/edit?returnTo=%2Fdavid");
    expect(
      presentationPresentPath("presentation-1", {
        returnTo: "/sales/membership-advisor",
      }),
    ).toBe(
      "/presentations/presentation-1/present?returnTo=%2Fsales%2Fmembership-advisor",
    );
  });

  it("rejects arbitrary or cross-site presentation return destinations", () => {
    expect(fieldWorkspaceReturnPath("https://example.com")).toBeNull();
    expect(fieldWorkspaceReturnPath("//example.com")).toBeNull();
    expect(fieldWorkspaceReturnPath("/hq")).toBeNull();
    expect(fieldWorkspaceReturnPath("/sales/david/extra")).toBeNull();
    expect(
      presentationWorkspacePath(
        { id: "presentation-1", status: "draft" },
        { returnTo: "https://example.com" },
      ),
    ).toBe("/presentations/presentation-1/edit");
  });

  it("returns a completed field close to its ledger while HQ stays in editor", () => {
    const presentationId = "15b81d70-aff4-40c5-a0fc-a74b915023c7";
    expect(presentationCompletionPath(presentationId, "/david")).toBe(
      `/david?closedPresentation=${presentationId}#verified-closes`,
    );
    expect(presentationCompletionPath(presentationId, "/hq")).toBe(
      `/presentations/${presentationId}/edit`,
    );
  });

  it("accepts only UUID presentation references for close verification", () => {
    expect(
      presentationCloseReference("15b81d70-aff4-40c5-a0fc-a74b915023c7"),
    ).toBe("15b81d70-aff4-40c5-a0fc-a74b915023c7");
    expect(presentationCloseReference("presentation-1")).toBeNull();
    expect(
      presentationCloseReference([
        "15b81d70-aff4-40c5-a0fc-a74b915023c7",
      ]),
    ).toBe("15b81d70-aff4-40c5-a0fc-a74b915023c7");
  });
});
