export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  const amount = Number.parseInt(digits, 10);
  return `$${amount.toLocaleString("en-US")}`;
}

export function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
