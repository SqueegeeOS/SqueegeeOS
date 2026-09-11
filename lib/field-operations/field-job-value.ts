import { TYLER_GERMANY_TECHNICIAN_ID } from "./technician-profile";

export interface FieldJobValue {
  amountCents: number | null;
  source: "jobber" | "hq";
}

/** Price access is granted by stable technician identity, never display name. */
export function canTechnicianViewJobValue(identityKey: string): boolean {
  return identityKey === `homeatlas:${TYLER_GERMANY_TECHNICIAN_ID}`;
}

export function fieldJobValue(amount: unknown, source: FieldJobValue["source"]): FieldJobValue {
  return {
    amountCents: typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0
      ? amount : null,
    source,
  };
}
