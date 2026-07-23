import type { HomeCarePlanData } from "./types";

const HOME_CARE_PLAN_CAPABILITY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHomeCarePlanCapability(value: string): boolean {
  return HOME_CARE_PLAN_CAPABILITY_PATTERN.test(value.trim());
}

export function getPlanPresentationPath(
  data: HomeCarePlanData,
  capability?: string,
): string {
  const base = `/homecare/${data.homeowner.slug}/${data.property.slug}/plan`;
  if (capability === undefined) return base;

  const normalized = capability.trim();
  if (!isHomeCarePlanCapability(normalized)) {
    throw new Error("Invalid Home Care Plan presentation capability");
  }

  return `${base}/${normalized}`;
}
