import Link from "next/link";
import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { technicianReferralCredit, type TechnicianReferralCredit } from "@/lib/hq/customer-workspace/technician-referral-credit";

/** Owner-only surfaces. Does not reveal the customer book to technicians. */
export function TechnicianReferralLabel({ lead }: { lead: LeadIntakeRecord }) {
  const credit = technicianReferralCredit(lead);
  if (!credit) return null;
  return (
    <p className="mt-2 text-sm text-accent">
      {credit.status === "recorded"
        ? `Referred by ${credit.technicianName}`
        : "Referral credit needs review"}
    </p>
  );
}

export function TechnicianReferralCreditCard({ credit, currentLeadId }: {
  credit: TechnicianReferralCredit | null | undefined;
  currentLeadId?: string | null;
}) {
  if (!credit) return null;
  return (
    <section aria-label="Technician referral credit" className="mb-6 rounded-2xl border border-accent/25 bg-accent/[0.06] p-4 sm:p-5">
      {credit.status === "unavailable" ? (
        <>
          <h2 className="font-medium text-foreground">Referral credit unavailable</h2>
          <p className="mt-1 text-sm text-muted">Refresh this workspace before reviewing commission. No credit has been reassigned.</p>
        </>
      ) : (
        <>
          <h2 className="font-medium text-foreground">Referred by {credit.technicianName}</h2>
          <p className="mt-1 text-sm text-muted">
            {credit.presentationId ? "Referral linked through its original presentation." : "Original referral recorded. No linked presentation confirmed here."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Commission needs owner review after the sale and collected payment. A signature or card on file is not proof of payment; no commission amount or payout is recorded here.
          </p>
          {currentLeadId !== credit.leadId ? <Link href={`/hq/requests/${encodeURIComponent(credit.leadId)}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg text-sm text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            Open original referral
          </Link> : null}
        </>
      )}
    </section>
  );
}
