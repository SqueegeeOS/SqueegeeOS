import { ROUTES } from "@/lib/navigation/config";

export const JOBBER_HANDOFF_STEPS = ["property", "job"] as const;

export type JobberHandoffStep = (typeof JOBBER_HANDOFF_STEPS)[number];

export interface JobberHandoffFocus {
  membershipId: string;
  step: JobberHandoffStep;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function resolveJobberHandoffFocus(input: {
  membership?: string | string[];
  step?: string | string[];
}): JobberHandoffFocus | null {
  const membershipId = first(input.membership);
  const step = first(input.step);
  if (!UUID_PATTERN.test(membershipId)) return null;
  if (!JOBBER_HANDOFF_STEPS.includes(step as JobberHandoffStep)) return null;
  return { membershipId, step: step as JobberHandoffStep };
}

export function jobberHandoffHref(
  membershipId: string,
  step: JobberHandoffStep,
): string {
  const params = new URLSearchParams({ membership: membershipId, step });
  return `${ROUTES.hqJobber}?${params.toString()}#jobber-visits`;
}
