"use client";

import { useState } from "react";
import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { signMembershipAgreement } from "@/lib/membership/agreement";
import type {
  MembershipAgreementRecord,
  MembershipPlanId,
  MembershipSignature,
} from "@/lib/membership/types";
import {
  agreementKindForPlan,
  oneTimeAgreementTemplatePath,
} from "@/lib/agreement/one-time-agreement";
import {
  membershipAgreementCheckboxText,
  oneTimeAgreementCheckboxText,
} from "@/lib/agreement/agreement-content";
import { AgreementModal } from "./agreement-modal";
import { AgreementSignaturePad } from "./agreement-signature-pad";
import { AgreementSummary } from "./agreement-summary";

const MEMBERSHIP_AGREEMENT_TEMPLATE_URL = "/documents/homeatlas-agreement.pdf";

interface AgreementFlowProps {
  planData: HomeCarePlanData;
  planId: MembershipPlanId;
  planName: string;
  tierPrice: string;
  tierPeriod: string;
  lifestyle: string;
  monthlyPrice?: number;
  memberEmail?: string | null;
  savedSignature?: MembershipSignature | null;
  onComplete: (
    signature: MembershipSignature,
    record: MembershipAgreementRecord,
  ) => void;
  onEdit?: () => void;
}

function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AgreementFlow({
  planData,
  planId,
  planName,
  tierPrice,
  tierPeriod,
  lifestyle,
  monthlyPrice,
  memberEmail,
  savedSignature,
  onComplete,
  onEdit,
}: AgreementFlowProps) {
  const [showPdf, setShowPdf] = useState(false);
  const [signature, setSignature] = useState<string | null>(
    savedSignature?.method === "drawn" ? savedSignature.signatureValue : null,
  );
  const [agreed, setAgreed] = useState(savedSignature?.agreedToTerms ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberName = planData.homeowner.fullName;
  const homeAddress = `${planData.property.address}, ${planData.property.city}`;
  const agreementKind = agreementKindForPlan(planId);
  const isOneTime = agreementKind === "one_time";
  const agreementTemplateUrl = isOneTime
    ? oneTimeAgreementTemplatePath()
    : MEMBERSHIP_AGREEMENT_TEMPLATE_URL;

  const handleSign = async () => {
    if (!signature || !agreed) return;

    setLoading(true);
    setError(null);

    try {
      const signedAt = new Date().toISOString();
      const membershipSignature: MembershipSignature = {
        method: "drawn",
        signerName: memberName,
        signatureValue: signature,
        signedAt,
        agreedToTerms: true,
        propertySlug: planData.property.slug,
        propertyName: planData.property.name,
        planId,
        planName,
      };

      const record = await signMembershipAgreement({
        signature: membershipSignature,
        homeownerSlug: planData.homeowner.slug,
        homeownerName: memberName,
        memberEmail,
        monthlyPrice,
      });

      onComplete(membershipSignature, record);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (savedSignature) {
    return (
      <div>
        <h2 className="font-serif text-2xl font-light text-foreground">
          Agreement signed
        </h2>
        <p className="mt-2 text-sm text-muted">
          {isOneTime
            ? "Your signed service agreement is on file. Continue to checkout when ready."
            : "Your signed membership agreement is on file. Continue to secure checkout when ready."}
        </p>

        <div className="mt-6 space-y-4 rounded-2xl border border-accent/25 bg-accent/5 p-5">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted">Signed by</span>
              <span className="text-right text-foreground">
                {savedSignature.signerName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Plan</span>
              <span className="text-right text-foreground">
                {savedSignature.planName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Date</span>
              <span className="text-right text-foreground">
                {formatDisplayDate(new Date(savedSignature.signedAt))}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={savedSignature.signatureValue}
              alt={`Signature of ${savedSignature.signerName}`}
              className="max-h-24 w-auto"
            />
          </div>
        </div>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="mt-4 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            Sign again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-light text-foreground">
          One last step.
        </h2>
        <p className="mt-2 text-sm text-muted">
          {isOneTime
            ? "Review your one-time service agreement and sign below."
            : "Review your membership agreement and sign below."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
          {planName}
        </span>
        <span className="text-foreground">
          {tierPrice}
          <span className="text-muted"> {tierPeriod}</span>
        </span>
        <span className="text-muted">{homeAddress}</span>
      </div>

      <AgreementSummary
        kind={agreementKind}
        tierName={planName}
        tierPrice={tierPrice}
        tierPeriod={tierPeriod}
        lifestyle={lifestyle}
      />

      <button
        type="button"
        onClick={() => setShowPdf(true)}
        className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-sm tracking-[0.06em] text-foreground touch-manipulation"
      >
        Read full {isOneTime ? "service agreement" : "agreement"}
      </button>

      {showPdf && (
        <AgreementModal
          pdfUrl={agreementTemplateUrl}
          kind={agreementKind}
          onClose={() => setShowPdf(false)}
        />
      )}

      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
          Sign below
        </p>
        <div className="mt-3">
          <AgreementSignaturePad
            onSigned={(dataUrl) => setSignature(dataUrl)}
            onCleared={() => setSignature(null)}
            disabled={loading}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Use your mouse or finger to sign
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface/50 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted">Name</span>
          <span className="text-foreground">{memberName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Date</span>
          <span className="text-foreground">{formatDisplayDate()}</span>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface/50 p-4 touch-manipulation">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-border accent-accent"
        />
        <span className="text-sm leading-relaxed text-foreground">
          {isOneTime
            ? oneTimeAgreementCheckboxText()
            : membershipAgreementCheckboxText()}
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSign}
        disabled={!signature || !agreed || loading}
        className="min-h-[52px] w-full rounded-full bg-accent text-sm font-medium tracking-[0.1em] text-background disabled:opacity-40"
      >
        {loading ? "Generating your agreement…" : isOneTime ? "Sign service agreement" : "Sign & continue"}
      </button>

      {loading && (
        <p className="text-center text-xs text-muted">
          Preparing your signed agreement…
        </p>
      )}
    </div>
  );
}
