"use client";

import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { useState } from "react";
import type { HomeCarePlanData } from "@/lib/home-care-plan/canyon-oaks";
import { saveMembershipAgreementMock } from "@/lib/membership/agreement";
import type {
  MembershipAgreementRecord,
  MembershipPlanId,
  MembershipSignature,
  SignatureMethod,
} from "@/lib/membership/types";
import { SignaturePad } from "./signature-pad";

interface MembershipSignatureStepProps {
  planData: HomeCarePlanData;
  planId: MembershipPlanId;
  planName: string;
  savedSignature: MembershipSignature | null;
  onSignatureSaved: (
    signature: MembershipSignature,
    agreementRecord: MembershipAgreementRecord,
  ) => void;
  onSignatureCleared: () => void;
}

function formatSignedAt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function MembershipSignatureStep({
  planData,
  planId,
  planName,
  savedSignature,
  onSignatureSaved,
  onSignatureCleared,
}: MembershipSignatureStepProps) {
  const [method, setMethod] = useState<SignatureMethod>("typed");
  const [signerName, setSignerName] = useState<string>(planData.homeowner.fullName);
  const [typedValue, setTypedValue] = useState("");
  const [drawnValue, setDrawnValue] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSaveTyped =
    agreedToTerms &&
    signerName.trim().length > 2 &&
    typedValue.trim().length > 2;

  const canSaveDrawn =
    agreedToTerms && signerName.trim().length > 2 && drawnValue !== null;

  const handleSaveTyped = async () => {
    if (!canSaveTyped) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const signedAt = new Date().toISOString();
      const signature: MembershipSignature = {
        method: "typed",
        signerName: signerName.trim(),
        signatureValue: typedValue.trim(),
        signedAt,
        agreedToTerms: true,
        propertySlug: planData.property.slug,
        propertyName: planData.property.name,
        planId,
        planName,
      };

      const record = await saveMembershipAgreementMock(
        signature,
        planData.homeowner.slug,
        planData.homeowner.fullName,
      );
      onSignatureSaved(signature, record);
    } catch {
      setSaveError("Unable to save signature. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDrawn = async (dataUrl: string) => {
    if (!agreedToTerms || signerName.trim().length <= 2) {
      setSaveError(
        "Please enter your name and accept the agreement before saving.",
      );
      return;
    }

    setDrawnValue(dataUrl);
    setIsSaving(true);
    setSaveError(null);

    try {
      const signedAt = new Date().toISOString();
      const signature: MembershipSignature = {
        method: "drawn",
        signerName: signerName.trim(),
        signatureValue: dataUrl,
        signedAt,
        agreedToTerms: true,
        propertySlug: planData.property.slug,
        propertyName: planData.property.name,
        planId,
        planName,
      };

      const record = await saveMembershipAgreementMock(
        signature,
        planData.homeowner.slug,
        planData.homeowner.fullName,
      );
      onSignatureSaved(signature, record);
    } catch {
      setSaveError("Unable to save signature. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSignature = () => {
    setDrawnValue(null);
    setTypedValue("");
    onSignatureCleared();
  };

  if (savedSignature) {
    return (
      <div>
        <h2 className="font-serif text-2xl font-light text-foreground">
          Signature saved
        </h2>
        <p className="mt-2 text-sm text-muted">
          Your agreement is recorded. Continue to secure checkout when ready.
        </p>

        <div className="mt-6 space-y-4 rounded-2xl border border-accent/25 bg-accent/5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300/90">
              Mock Save — Not Active
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted">Signed by</span>
              <span className="text-right text-foreground">
                {savedSignature.signerName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Property</span>
              <span className="text-right text-foreground">
                {savedSignature.propertyName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Plan</span>
              <span className="text-right text-foreground">
                {savedSignature.planName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Signed at</span>
              <span className="text-right text-foreground">
                {formatSignedAt(savedSignature.signedAt)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Method</span>
              <span className="text-foreground capitalize">
                {savedSignature.method}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            {savedSignature.method === "typed" ? (
              <p className="plan-handwritten text-3xl text-foreground/85">
                {savedSignature.signatureValue}
              </p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={savedSignature.signatureValue}
                alt={`Signature of ${savedSignature.signerName}`}
                className="max-h-24 w-auto"
              />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleEditSignature}
          className="mt-4 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          Edit signature
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-serif text-2xl font-light text-foreground">
        Sign your agreement
      </h2>
      <p className="mt-2 text-sm text-muted">
        Type or draw your signature, then save to continue.
      </p>

      <div className="mt-5 flex rounded-full border border-border bg-surface p-1">
        {(["typed", "drawn"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMethod(option)}
            className={`min-h-[44px] flex-1 rounded-full text-sm tracking-[0.06em] touch-manipulation ${
              method === option
                ? "bg-accent text-background"
                : "text-muted"
            }`}
          >
            {option === "typed" ? "Type Signature" : "Draw Signature"}
          </button>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
          Signed by
        </span>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder={planData.homeowner.fullName}
          className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-foreground"
        />
      </label>

      {method === "typed" ? (
        <div className="mt-5">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
              Type your signature
            </span>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={planData.homeowner.fullName}
              className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-foreground"
            />
          </label>
          {typedValue.trim().length > 2 && (
            <p className="plan-handwritten mt-4 text-3xl text-foreground/80">
              {typedValue}
            </p>
          )}
          <button
            type="button"
            onClick={handleSaveTyped}
            disabled={!canSaveTyped || isSaving}
            className="mt-5 min-h-[48px] w-full rounded-full bg-accent text-sm font-medium tracking-[0.08em] text-background disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save signature"}
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <SignaturePad
            onSave={handleSaveDrawn}
            disabled={
              isSaving ||
              !agreedToTerms ||
              signerName.trim().length <= 2
            }
          />
          {(!agreedToTerms || signerName.trim().length <= 2) && (
            <p className="mt-3 text-xs text-muted">
              Enter your name and accept the agreement before saving a drawn
              signature.
            </p>
          )}
        </div>
      )}

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface/50 p-4 touch-manipulation">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-border accent-accent"
        />
        <span className="text-sm leading-relaxed text-foreground">
          I agree to the {CUSTOMER_BRAND.name} Home Care Membership terms.
        </span>
      </label>

      {!agreedToTerms && (
        <p className="mt-2 text-xs text-muted">
          Agreement acceptance is required before saving your signature.
        </p>
      )}

      {saveError && (
        <p className="mt-3 text-sm text-red-400">{saveError}</p>
      )}

      <p className="mt-4 text-xs text-muted">
        Agreement and signature are saved locally for now — PDF generation,
        property documents, and email delivery are not active yet.
      </p>
    </div>
  );
}
