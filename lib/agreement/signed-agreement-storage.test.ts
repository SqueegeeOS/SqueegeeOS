import { describe, expect, it } from "vitest";
import {
  formatSignedAgreementStorageRef,
  parseSignedAgreementStoragePath,
  SIGNED_AGREEMENT_BUCKET,
} from "./signed-agreement-storage";

describe("signed-agreement-storage", () => {
  it("formats and parses storage refs", () => {
    const ref = formatSignedAgreementStorageRef("noah-oak-agreement-1.pdf");
    expect(ref).toBe(`storage:${SIGNED_AGREEMENT_BUCKET}/noah-oak-agreement-1.pdf`);
    expect(parseSignedAgreementStoragePath(ref)).toBe(
      "noah-oak-agreement-1.pdf",
    );
  });

  it("parses legacy public URLs", () => {
    const legacy = `https://project.supabase.co/storage/v1/object/public/${SIGNED_AGREEMENT_BUCKET}/noah-oak-agreement-1.pdf`;
    expect(parseSignedAgreementStoragePath(legacy)).toBe(
      "noah-oak-agreement-1.pdf",
    );
  });
});
