const EXPECTED_HOSTED_PAYMENT_HANDOFF_ERRORS = new Set([
  "Membership not found.",
  "This membership no longer needs a card setup link.",
  "The membership is missing its signed presentation binding.",
  "The signed customer record is incomplete.",
  "Completed standing billing authorization is required.",
  "This customer does not have a valid email address.",
  "This membership already completed card setup.",
  "Card setup retry limit reached. Review this member in HQ.",
  "Stripe is not configured for hosted card setup.",
  "The Stripe link is ready, but the email provider did not accept the message.",
]);

export function publicHostedPaymentHandoffError(error: unknown): {
  message: string;
  status: number;
} {
  const message = error instanceof Error ? error.message : "unknown";
  if (EXPECTED_HOSTED_PAYMENT_HANDOFF_ERRORS.has(message)) {
    return {
      message,
      status: message.includes("not configured") ? 503 : 409,
    };
  }
  return {
    message:
      "The secure card setup email could not be sent. Review production health and try again.",
    status: 500,
  };
}
