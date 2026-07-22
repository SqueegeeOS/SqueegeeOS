import { describe, expect, it } from "vitest";
import {
  decodeAndValidateSignaturePng,
  InvalidSignaturePngError,
} from "./validate-signature-png";

const VALID_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("signature PNG structural validation", () => {
  it("fully decodes a valid bounded PNG", async () => {
    await expect(decodeAndValidateSignaturePng(VALID_PNG)).resolves.toEqual(
      expect.any(Uint8Array),
    );
  });

  it.each([
    "data:image/png;base64,iVBORw0KGgo=",
    `data:image/png;base64,${Buffer.from(
      Buffer.from(VALID_PNG.split(",")[1], "base64").subarray(0, 40),
    ).toString("base64")}`,
    `data:image/png;base64,${(() => {
      const corrupt = Buffer.from(VALID_PNG.split(",")[1], "base64");
      corrupt[corrupt.length - 1] ^= 1;
      return corrupt.toString("base64");
    })()}`,
  ])("rejects truncated or corrupt evidence before authority is claimed", async (dataUrl) => {
    await expect(decodeAndValidateSignaturePng(dataUrl)).rejects.toBeInstanceOf(
      InvalidSignaturePngError,
    );
  });
});
