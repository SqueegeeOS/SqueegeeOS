"use client";

export function EnrollmentReviewPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#173f35] px-5 text-xs font-semibold text-white transition hover:bg-[#215346] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]"
    >
      Print / Save PDF
    </button>
  );
}
