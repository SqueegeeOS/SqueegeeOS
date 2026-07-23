export const HQ_AUTH_RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
} as const;

export function applyHqAuthResponseHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(HQ_AUTH_RESPONSE_HEADERS)) {
    headers.set(name, value);
  }
}
