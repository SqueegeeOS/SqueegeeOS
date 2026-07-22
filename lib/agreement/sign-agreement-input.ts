import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export const SIGN_AGREEMENT_MAX_BODY_BYTES = 1024 * 1024;
export const SIGNATURE_MAX_DECODED_BYTES = 512 * 1024;

export interface PublicSignAgreementInput {
  presentationId: string;
  agreementTier: SqueegeeKingTierId;
  signatureDataUrl: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

export function parsePublicSignAgreementInput(
  value: Record<string, unknown>,
): PublicSignAgreementInput | null {
  if (
    !hasExactKeys(value, [
      "agreementTier",
      "presentationId",
      "signatureDataUrl",
    ]) ||
    typeof value.presentationId !== "string" ||
    !UUID_PATTERN.test(value.presentationId) ||
    (value.agreementTier !== "biannual" &&
      value.agreementTier !== "quarterly") ||
    typeof value.signatureDataUrl !== "string"
  ) {
    return null;
  }

  const match = value.signatureDataUrl.match(PNG_DATA_URL_PATTERN);
  if (!match?.[1]) return null;

  const signatureBytes = Buffer.from(match[1], "base64");
  if (
    signatureBytes.byteLength < 45 ||
    signatureBytes.byteLength > SIGNATURE_MAX_DECODED_BYTES ||
    signatureBytes[0] !== 0x89 ||
    signatureBytes[1] !== 0x50 ||
    signatureBytes[2] !== 0x4e ||
    signatureBytes[3] !== 0x47 ||
    signatureBytes[4] !== 0x0d ||
    signatureBytes[5] !== 0x0a ||
    signatureBytes[6] !== 0x1a ||
    signatureBytes[7] !== 0x0a
  ) {
    return null;
  }

  return {
    presentationId: value.presentationId,
    agreementTier: value.agreementTier,
    signatureDataUrl: value.signatureDataUrl,
  };
}
