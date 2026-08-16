export const SALES_DOOR_DISPOSITIONS = [
  "not_home",
  "conversation",
  "follow_up",
  "interested",
  "not_interested",
  "do_not_knock",
] as const;

export type SalesDoorDisposition = (typeof SALES_DOOR_DISPOSITIONS)[number];

export function normalizeSalesDoorAddress(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeSalesDoorAddressKey(value: string): string {
  return normalizeSalesDoorAddress(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function salesDoorDispositionLabel(
  disposition: SalesDoorDisposition,
): string {
  switch (disposition) {
    case "not_home":
      return "No answer";
    case "conversation":
      return "Talked";
    case "follow_up":
      return "Follow up";
    case "interested":
      return "Interested";
    case "not_interested":
      return "Not now";
    case "do_not_knock":
      return "Do not knock";
  }
}
