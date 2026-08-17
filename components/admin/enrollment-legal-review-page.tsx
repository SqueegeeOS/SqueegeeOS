import Link from "next/link";
import { EnrollmentReviewPrintButton } from "@/components/admin/enrollment-review-print-button";
import type { EnrollmentLegalReviewPacket } from "@/lib/enrollment/legal-review-packet";

export function EnrollmentLegalReviewPage({
  packet,
}: {
  packet: EnrollmentLegalReviewPacket;
}) {
  return (
    <main className="min-h-screen bg-[#f2efe8] px-4 py-8 text-[#1c211f] sm:px-6 sm:py-12">
      <style>{`
        @media print {
          @page { size: letter; margin: 0.55in; }
          body { background: white !important; }
          .counsel-packet-controls { display: none !important; }
          .counsel-packet-shell { max-width: none !important; padding: 0 !important; box-shadow: none !important; }
          .counsel-document { break-before: page; }
          .counsel-review-card, .counsel-section { break-inside: avoid; }
          .counsel-source-link { color: #111 !important; overflow-wrap: anywhere; }
        }
      `}</style>

      <div className="counsel-packet-controls mx-auto mb-5 flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/hq/enrollment"
          className="text-xs font-semibold text-[#315c51] underline decoration-[#315c51]/30 underline-offset-4"
        >
          ← Back to Enrollment Desk
        </Link>
        <EnrollmentReviewPrintButton />
      </div>

      <article className="counsel-packet-shell mx-auto max-w-4xl rounded-[2rem] bg-white p-6 shadow-[0_24px_80px_rgba(26,38,34,0.12)] sm:p-10 lg:p-14">
        <header className="border-b-2 border-[#173f35] pb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#315c51]">
            HomeAtlas agreement release packet
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#102a24] sm:text-5xl">
            {packet.packetLabel}
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[#4a5652]">
            {packet.summary}
          </p>

          <div className="mt-7 rounded-2xl border-2 border-[#9d3b31] bg-[#fff4f1] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a2f27]">
              Not yet owner-released to customers
            </p>
            <p className="mt-2 text-sm leading-6 text-[#63342f]">
              This is an owner-release candidate, not a claim of legal advice
              or outside-counsel approval. HomeAtlas keeps customer sends
              blocked until the exact DocuSign files are inspected, versioned,
              SHA-256 fingerprinted, and deliberately released by the owner.
            </p>
          </div>

          <dl className="mt-7 grid gap-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-bold uppercase tracking-[0.12em] text-[#66716d]">
                Statutory source check
              </dt>
              <dd className="mt-1 text-[#1c211f]">
                <time dateTime={packet.sourceCheckedAt}>August 16, 2026</time>
              </dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-[0.12em] text-[#66716d]">
                Intended transaction
              </dt>
              <dd className="mt-1 text-[#1c211f]">
                California residential recurring property services
              </dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-[0.12em] text-[#66716d]">
                Review packet revision
              </dt>
              <dd className="mt-1 text-[#1c211f]">
                {packet.packetRevision}
              </dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-[0.12em] text-[#66716d]">
                Packet fingerprint
              </dt>
              <dd className="mt-1 break-all font-mono text-[10px] leading-5 text-[#1c211f]">
                SHA-256 {packet.integrity.sha256}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[11px] leading-5 text-[#66716d]">
            The fingerprint identifies this exact internal review copy. It is
            change-control evidence only—not the hash of a released DocuSign
            document and not a claim of legal approval.
          </p>
        </header>

        <section className="mt-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#315c51]">
            Owner release decisions
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#102a24]">
            Resolve these before the first rehearsal
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Enter the exact LLC seller identity and legal notice channels shown in every agreement.",
              "Select and release the correct current statutory notice lane for each customer-home sale.",
              "Accept the automatic-renewal disclosure, affirmative-consent block, reminders, and direct cancellation mechanics.",
              "Accept or revise the enrollment-savings reimbursement and liability language as a business decision.",
              "Inspect the exact two-document DocuSign order, tabs, signature placement, and retainable copies.",
              "Run the read-only provider probe, then bind the downloaded provider-file fingerprints before rehearsal.",
            ].map((item) => (
              <div
                key={item}
                className="counsel-review-card rounded-xl border border-[#d9ddd8] bg-[#f8f8f5] p-4 text-sm leading-6 text-[#3e4945]"
              >
                <span className="mr-2 text-[#315c51]">□</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        {packet.documents.map((document) => (
          <section key={document.id} className="counsel-document mt-12">
            <div className="border-b border-[#cfd5d1] pb-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#315c51]">
                    {document.version}
                  </p>
                  <h2 className="mt-2 font-serif text-3xl leading-tight text-[#102a24] sm:text-4xl">
                    {document.title}
                  </h2>
                </div>
                <span className="w-fit rounded-full border border-[#b46945] bg-[#fff7ef] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b4d2d]">
                  {document.status === "working_draft"
                    ? "Owner-release candidate"
                    : "Statutory text required"}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#59635f]">
                {document.purpose}
              </p>
              <p className="mt-3 break-all font-mono text-[10px] leading-5 text-[#6d7773]">
                Review-copy SHA-256 {document.integrity.sha256}
              </p>
            </div>

            <div className="mt-6 space-y-6">
              {document.sections.map((section) => (
                <section key={section.heading} className="counsel-section">
                  <h3 className="text-base font-bold text-[#1b3931]">
                    {section.heading}
                  </h3>
                  <div className="mt-2 space-y-2">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-sm leading-7 text-[#424d49]"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <aside className="counsel-review-card mt-7 rounded-2xl border border-[#d7c7a4] bg-[#fffbef] p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#775e29]">
                Release focus
              </h3>
              <ul className="mt-3 space-y-2">
                {document.reviewFocus.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-[#554b35]">
                    <span aria-hidden="true">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </section>
        ))}

        <section className="counsel-document mt-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#315c51]">
            Operating architecture
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#102a24]">
            What HomeAtlas does after owner release
          </h2>
          <ol className="mt-6 space-y-4">
            {packet.customerJourney.map((step) => (
              <li key={step.step} className="counsel-section flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#173f35] text-xs font-bold text-white">
                  {step.step}
                </span>
                <div>
                  <h3 className="font-bold text-[#1b3931]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#4b5652]">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mt-9 text-xs font-bold uppercase tracking-[0.15em] text-[#315c51]">
            Release controls that remain mandatory
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {packet.operatingRules.map((rule) => (
              <li
                key={rule}
                className="counsel-review-card rounded-xl border border-[#d5ddd9] p-4 text-sm leading-6 text-[#424d49]"
              >
                <span className="mr-2 font-bold text-[#23715e]">✓</span>
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section className="counsel-document mt-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#315c51]">
            Primary authorities
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#102a24]">
            Current primary sources
          </h2>
          <ul className="mt-5 space-y-3">
            {packet.sourceLinks.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="counsel-source-link text-sm font-semibold text-[#315c51] underline decoration-[#315c51]/30 underline-offset-4"
                >
                  {source.label}
                </a>
                <p className="mt-1 text-[11px] leading-5 text-[#707a76]">
                  {source.href}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid gap-7 border-t border-[#cfd5d1] pt-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#59635f]">
                Owner release record
              </p>
              <div className="mt-8 border-b border-[#89928f]" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#59635f]">
                Release date
              </p>
              <div className="mt-8 border-b border-[#89928f]" />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#59635f]">
                Later counsel notes / required changes
              </p>
              <div className="mt-12 border-b border-[#89928f]" />
              <div className="mt-12 border-b border-[#89928f]" />
            </div>
          </div>
        </section>

        <footer className="mt-12 border-t border-[#cfd5d1] pt-5 text-[11px] leading-5 text-[#717a77]">
          Internal HomeAtlas release artifact. Printing or exporting this packet
          does not release a legal version, configure DocuSign, or authorize a
          customer send. Outside counsel can review this exact revision later.
        </footer>
      </article>
    </main>
  );
}
