"use client";

interface AgreementModalProps {
  pdfUrl: string;
  onClose: () => void;
}

export function AgreementModal({ pdfUrl, onClose }: AgreementModalProps) {
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
            HomeAtlas Membership Agreement
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

        <div className="min-h-[50vh] flex-1 bg-surface">
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            className="h-full min-h-[50vh] w-full border-0"
            title="HomeAtlas Membership Agreement"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a
            href={pdfUrl}
            download="HomeAtlas-Membership-Agreement.pdf"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Download PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] rounded-full bg-accent px-6 text-sm font-medium tracking-[0.08em] text-background"
          >
            Close &amp; Sign
          </button>
        </div>
      </div>
    </div>
  );
}
