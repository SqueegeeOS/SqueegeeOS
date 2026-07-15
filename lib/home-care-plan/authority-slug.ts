import { createHash } from "node:crypto";

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function customerAuthoritySlugSuffix(input: {
  fullName: string;
  email: string;
  propertyName: string;
  address: string;
}): string {
  return createHash("sha256")
    .update([
      normalized(input.fullName),
      normalized(input.email),
      normalized(input.propertyName),
      normalized(input.address),
    ].join("\u0000"))
    .digest("hex")
    .slice(0, 16);
}
