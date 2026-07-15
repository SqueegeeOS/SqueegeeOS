import { resolveStripeKeyMode } from "./mode";

export function isStripeServerEnabled(): boolean {
  const mode = resolveStripeKeyMode();
  return mode === "test" || mode === "live";
}
