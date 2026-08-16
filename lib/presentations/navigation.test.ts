import { describe, expect, it } from "vitest";
import { presentationWorkspacePath } from "./navigation";

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
});
