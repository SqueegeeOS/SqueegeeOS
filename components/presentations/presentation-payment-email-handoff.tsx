"use client";

import { useState } from "react";
import { PaymentSetupEmailButton } from "@/components/admin/payment-setup-email-button";
import { normalizeEmailDestination } from "@/lib/communications/providers/contracts";

export function PresentationPaymentEmailHandoff({
  membershipId,
  presentationId,
  customerEmail,
  returnLabel,
  onReturn,
}: {
  membershipId: string | null;
  presentationId: string;
  customerEmail?: string | null;
  returnLabel: string;
  onReturn: () => void;
}) {
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null);
  const normalizedEmail = normalizeEmailDestination(customerEmail);
  const canSend = Boolean(membershipId && normalizedEmail);

  return (
    <section
      aria-labelledby="presentation-payment-email-heading"
      className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4 text-left sm:p-5"
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-200/65">
        Finish on their phone
      </p>
      <h3
        id="presentation-payment-email-heading"
        className="mt-2 font-serif text-xl font-light text-[#f5f2eb]"
      >
        Email the secure Stripe step
      </h3>
      <p className="mt-2 text-xs leading-5 text-white/52">
        {normalizedEmail
          ? `Send Stripe's hosted card setup to ${normalizedEmail}.`
          : "Add a valid customer email before sending the secure Stripe step."} {" "}
        No charge occurs here, and HomeAtlas never sees or stores the card number.
      </p>

      {acceptedMessage ? (
        <div
          className="mt-4 rounded-xl border border-emerald-200/20 bg-black/20 p-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-emerald-100">
            Stripe setup email accepted.
          </p>
          <p className="mt-1 text-xs leading-5 text-white/48">
            {acceptedMessage} HomeAtlas will keep this close in the owner queue
            until Stripe confirms the saved card.
          </p>
          <button
            type="button"
            onClick={onReturn}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-emerald-200/25 bg-emerald-200/10 px-4 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-200/15"
          >
            {returnLabel}
          </button>
        </div>
      ) : (
        <div className="mt-4 [&_button]:w-full">
          <PaymentSetupEmailButton
            membershipId={membershipId}
            presentationId={presentationId}
            canSend={canSend}
            variant="primary"
            onAccepted={setAcceptedMessage}
          />
          <p className="mt-2 text-[10px] leading-4 text-white/38">
            Nothing sends until you press the labeled email button. The link is
            valid for 24 hours and can be safely reissued from HQ if it expires.
          </p>
        </div>
      )}
    </section>
  );
}
