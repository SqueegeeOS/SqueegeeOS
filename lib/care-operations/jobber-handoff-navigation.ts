import { ROUTES } from "@/lib/navigation/config";
import {
  jobberTodayVisitAnchorId,
  jobberVisitWorkspaceAnchorId,
} from "./jobber-today-links";

export const JOBBER_HANDOFF_STEPS = ["property", "job"] as const;

export type JobberHandoffStep = (typeof JOBBER_HANDOFF_STEPS)[number];

export interface JobberHandoffFocus {
  membershipId: string | null;
  projectionId: string | null;
  step: JobberHandoffStep;
  returnTo: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function safeTodayReturnPath(value: string | string[] | undefined): string {
  const candidate = first(value);
  if (!candidate || candidate.length > 500) return ROUTES.hqToday;
  if (!candidate.startsWith(`${ROUTES.hqToday}#`)) return ROUTES.hqToday;
  const fragment = candidate.slice(`${ROUTES.hqToday}#`.length);
  return /^[a-zA-Z0-9_-]{1,200}$/.test(fragment)
    ? candidate
    : ROUTES.hqToday;
}

export function resolveJobberHandoffFocus(input: {
  membership?: string | string[];
  projection?: string | string[];
  step?: string | string[];
  returnTo?: string | string[];
}): JobberHandoffFocus | null {
  const membershipId = first(input.membership);
  const projectionId = first(input.projection);
  const step = first(input.step);
  if (UUID_PATTERN.test(membershipId)) {
    if (!JOBBER_HANDOFF_STEPS.includes(step as JobberHandoffStep)) return null;
    return {
      membershipId,
      projectionId: null,
      step: step as JobberHandoffStep,
      returnTo: null,
    };
  }
  if (UUID_PATTERN.test(projectionId) && step === "property") {
    return {
      membershipId: null,
      projectionId,
      step: "property",
      returnTo: safeTodayReturnPath(input.returnTo),
    };
  }
  return null;
}

export function jobberHandoffHref(
  membershipId: string,
  step: JobberHandoffStep,
): string {
  const params = new URLSearchParams({ membership: membershipId, step });
  return `${ROUTES.hqJobber}?${params.toString()}#jobber-visits`;
}

export function jobberTodayPairingHref(projectionId: string): string {
  const returnTo = `${ROUTES.hqToday}#${jobberTodayVisitAnchorId(projectionId)}`;
  const params = new URLSearchParams({
    projection: projectionId,
    step: "property",
    returnTo,
  });
  return `${ROUTES.hqJobber}?${params.toString()}#${jobberVisitWorkspaceAnchorId(projectionId)}`;
}

export function jobberHandoffResumeHref(focus: JobberHandoffFocus): string {
  if (focus.membershipId) {
    return jobberHandoffHref(focus.membershipId, focus.step);
  }
  if (focus.projectionId) {
    const params = new URLSearchParams({
      projection: focus.projectionId,
      step: "property",
      returnTo: focus.returnTo ?? ROUTES.hqToday,
    });
    return `${ROUTES.hqJobber}?${params.toString()}#${jobberVisitWorkspaceAnchorId(focus.projectionId)}`;
  }
  return ROUTES.hqJobber;
}

export function resolveJobberHandoffResumePath(
  value: string | null | undefined,
): string | null {
  const candidate = value?.trim() ?? "";
  if (!candidate || candidate.length > 1_000 || !candidate.startsWith("/")) {
    return null;
  }
  try {
    const base = new URL("https://homeatlas.invalid");
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin || parsed.pathname !== ROUTES.hqJobber) {
      return null;
    }
    const focus = resolveJobberHandoffFocus({
      membership: parsed.searchParams.get("membership") ?? undefined,
      projection: parsed.searchParams.get("projection") ?? undefined,
      step: parsed.searchParams.get("step") ?? undefined,
      returnTo: parsed.searchParams.get("returnTo") ?? undefined,
    });
    return focus ? jobberHandoffResumeHref(focus) : null;
  } catch {
    return null;
  }
}
