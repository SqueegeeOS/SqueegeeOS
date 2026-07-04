import {
  ONE_TIME_SERVICE_SCOPE,
  ONE_TIME_SUMMARY_POINTS,
  planNameForOneTimeAgreement,
} from "./one-time-agreement";

export const MEMBERSHIP_SUMMARY_POINTS = [
  "Scheduled home care visits based on your membership tier",
  "Priority booking for additional services",
  "Documented property history in your member portal",
  "Automatic add-on discount while membership payments are active (20% Bi-Annual · 25% Quarterly)",
  "Cancel with thirty days written notice",
] as const;

export function membershipAgreementCheckboxText(): string {
  return "I have read and agree to the HomeAtlas Membership Agreement. I understand this is a legally binding signature.";
}

export function oneTimeAgreementCheckboxText(): string {
  return "I have read and agree to the One-Time Service Agreement. I understand this covers a single visit only and does not enroll me in membership.";
}

export function oneTimeEnrollmentCopy(
  tierName: string,
  tierPrice: string,
  tierPeriod: string,
): string {
  return `You are authorizing a single service visit under the ${planNameForOneTimeAgreement()}. ${tierName} at ${tierPrice} ${tierPeriod}. This agreement does not include membership benefits.`;
}

export { ONE_TIME_SUMMARY_POINTS, ONE_TIME_SERVICE_SCOPE };
