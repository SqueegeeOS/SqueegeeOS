import { buildPortalAccessPath } from "@/lib/membership/portal-access";

export function buildJobberTodayPortalPath(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const normalized = token.trim();
  return normalized ? buildPortalAccessPath(normalized) : null;
}

export function isMissingMembershipPortalAccessSchema(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = error.message?.toLocaleLowerCase("en-US") ?? "";
  return (
    message.includes("portal_access_token") &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      message.includes("does not exist") ||
      message.includes("schema cache"))
  );
}
