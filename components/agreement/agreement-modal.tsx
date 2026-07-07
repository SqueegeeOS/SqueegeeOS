"use client";

import type { AgreementKind } from "@/lib/agreement/one-time-agreement";
import {
  ONE_TIME_AGREEMENT_TITLE,
  ONE_TIME_SERVICE_SCOPE,
} from "@/lib/agreement/one-time-agreement";
import { MEMBERSHIP_BILLING_FINE_PRINT } from "@/lib/agreement/agreement-content";

interface AgreementModalProps {
  pdfUrl: string;
  kind?: AgreementKind;
  onClose: () => void;
}

export function AgreementModal({
  pdfUrl,
  kind = "membership",
  onClose,
}: AgreementModalProps) {
  const isOneTime = kind === "one_time";
  const title = isOneTime
    ? ONE_TIME_AGREEMENT_TITLE
    : "SqueegeeKing Membership Agreement";
  const downloadName = isOneTime
    ? "SqueegeeKing-One-Time-Service-Agreement.pdf"
    : "SqueegeeKing-Membership-Agreement.pdf";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreement-modal-title"
    >
      <div className="flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background sm:rounded-[2rem]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h3
            id="agreement-modal-title"
            className="font-serif text-xl font-light text-foreground"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-2xl leading-none text-muted"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-[50vh] flex-1 overflow-y-auto bg-surface">
          {isOneTime ? (
            <div className="space-y-5 p-6 text-sm leading-relaxed text-foreground">
              <p className="font-medium uppercase tracking-[0.12em] text-muted">
                One-time service — not a membership
              </p>
              <p>
                This agreement covers a single scheduled visit only. No recurring
                membership, member portal access, priority booking, or add-on
                discounts are included unless you separately enroll in a
                membership plan.
              </p>
              <div>
                <p className="mb-2 font-medium">Scope of work</p>
                <ul className="list-disc space-y-1.5 pl-5 text-muted">
                  {ONE_TIME_SERVICE_SCOPE.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <p>
                <span className="font-medium">7-Day Workmanship Guarantee:</span>{" "}
                If you are not satisfied with workmanship on the completed visit,
                contact us within seven (7) days and we will make it right.
              </p>
              <p className="text-muted">
                A signed copy with your visit price will be generated when you
                complete your signature below.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 border-b border-border p-6 text-sm leading-relaxed text-foreground">
                <p className="font-medium uppercase tracking-[0.12em] text-muted">
                  Billing &amp; payment
                </p>
                {MEMBERSHIP_BILLING_FINE_PRINT.split("\n\n")
                  .slice(1)
                  .join("\n\n")
                  .split("\n")
                  .filter(Boolean)
                  .map((line) => (
                    <p key={line} className="text-muted">
                      {line}
                    </p>
                  ))}
              </div>
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="h-full min-h-[50vh] w-full border-0"
                title={title}
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {!isOneTime && (
            <a
              href={pdfUrl}
              download={downloadName}
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Download PDF
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] rounded-full bg-accent px-6 text-sm font-medium tracking-[0.08em] text-background sm:ml-auto"
          >
            Close &amp; Sign
          </button>
        </div>
      </div>
    </div>
  );
}
