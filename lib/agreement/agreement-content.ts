import {
  ONE_TIME_SERVICE_SCOPE,
  ONE_TIME_SUMMARY_POINTS,
  planNameForOneTimeAgreement,
} from "./one-time-agreement";

/** HomeAtlas billing philosophy — customer-facing framing across the journey */
export const MEMBERSHIP_BILLING_PHILOSOPHY =
  "Payment should disappear into the experience so care can remain at the center of it.";

export const MEMBERSHIP_BILLING_SUMMARY =
  "Your card is charged on the 1st of the month in which your scheduled membership visit occurs";

export const MEMBERSHIP_BILLING_SCHEDULE_HEADLINE = "How billing works";

export const MEMBERSHIP_BILLING_SCHEDULE_BODY =
  "Your membership is billed on the 1st of the month in which your recurring service is scheduled. Your visit is completed during that same month — so when your technician arrives, there is nothing left to pay.";

export const MEMBERSHIP_CARD_ON_FILE_WHY =
  "We keep a secure payment method on file and charge on the 1st of each scheduled service month. Payment is never collected at the door — your technician can focus entirely on caring for your home, and you enjoy a more seamless, professional experience.";

export const MEMBERSHIP_BILLING_REMINDER =
  "Your card is charged on the 1st of each scheduled service month. No payment is collected at the door — care stays at the center of every visit.";

export const MEMBERSHIP_NEXT_BILLING_LABEL =
  "The 1st of each scheduled service month";

export const MEMBERSHIP_CLOSE_BILLING_BULLETS = [
  "Nothing to pay at signing today",
  "Billed on the 1st of your scheduled service month",
  "No payment when we arrive — care stays at the center",
] as const;

export const PORTAL_EMPTY_COPY = {
  storyHeadline: "Your home's story starts soon.",
  nextVisit:
    "We're scheduling your first visit — you'll hear from us, nothing to do.",
  timeline: "Chapter one begins with your first visit.",
  photos: "Your home's gallery begins with your first visit.",
} as const;

export const MEMBERSHIP_ONBOARDING_PAYMENT_POINTS = [
  {
    title: "Card on file",
    description:
      "Your payment method is stored securely — you enter it once, and billing happens automatically.",
  },
  {
    title: "Billed on the 1st",
    description:
      "Your card is charged on the 1st of the month in which your recurring service is scheduled.",
  },
  {
    title: "Care at the center",
    description:
      "When your technician arrives, there is nothing left to pay. They focus on your home — not payment at the door.",
  },
  {
    title: "A seamless experience",
    description:
      "Billing happens quietly in the background so your membership feels professional, predictable, and effortless.",
  },
] as const;

export const MEMBERSHIP_BILLING_FINE_PRINT = `BILLING & PAYMENT

${MEMBERSHIP_BILLING_PHILOSOPHY}

Your payment method on file will be charged on the 1st day of each month in which your membership visit is scheduled. Service is completed during that same calendar month. Payment is not collected at the door.

If a charge fails, scheduling and member benefits (including add-on discounts) may be suspended until payment is resolved.`;

/** Body copy only — use when the PDF section heading is drawn separately */
export const MEMBERSHIP_BILLING_FINE_PRINT_BODY =
  MEMBERSHIP_BILLING_FINE_PRINT.replace(/^BILLING & PAYMENT\s*\n+/i, "").trim();

export const MEMBERSHIP_SUMMARY_POINTS = [
  MEMBERSHIP_BILLING_SUMMARY,
  "Scheduled home care visits based on your membership tier",
  "Priority booking for additional services",
  "Documented property history in your member portal",
  "Automatic add-on discount while membership payments are active (20% Bi-Annual · 25% Quarterly)",
  "Cancel with thirty days written notice",
] as const;

export function membershipAgreementCheckboxText(): string {
  return "I have read and agree to the SqueegeeKing Membership Agreement, including billing on the 1st of each scheduled service month with no payment collected at the door. I understand this is a legally binding signature.";
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
