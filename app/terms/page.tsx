import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms for using the SqueegeeKing website and HomeAtlas experiences.",
};

export default function TermsOfUsePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-24 text-foreground sm:py-32">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">
        Effective August 2, 2026
      </p>
      <h1 className="mt-4 font-serif text-5xl font-light">Terms of Use</h1>
      <div className="mt-10 space-y-8 text-sm leading-7 text-muted sm:text-base">
        <p>
          These terms govern your use of the SqueegeeKing website and its
          HomeAtlas experiences. Using the site means you agree to these terms.
          A quote request is not a binding service agreement; scope, timing,
          price, and recurring-service terms are confirmed separately.
        </p>

        <section>
          <h2 className="font-serif text-2xl text-foreground">Acceptable use</h2>
          <p className="mt-3">
            Do not interfere with the site, attempt unauthorized access, submit
            unlawful or misleading material, or copy, scrape, bulk-download, or
            redistribute third-party content displayed here.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">Google Maps content</h2>
          <p className="mt-3">
            Maps, place details, reviews, author attribution, and related links
            may be supplied by Google. Your use of Google Maps content is also
            subject to the{" "}
            <a
              href="https://maps.google.com/help/terms_maps/"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-4"
            >
              Google Maps/Google Earth Additional Terms of Service
            </a>{" "}
            and the{" "}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-4"
            >
              Google Terms of Service
            </a>
            . Review text and author materials remain attributable to their
            respective authors and providers.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">Availability and liability</h2>
          <p className="mt-3">
            We work to keep information accurate and the site available, but
            third-party data and services can change or become unavailable. To
            the extent permitted by law, the site is provided as available and
            SqueegeeKing is not responsible for indirect or consequential loss
            arising only from use of this website.
          </p>
        </section>

        <p>
          We may update these terms by posting a new effective date. Questions
          can be sent through our <Link href="/contact" className="text-accent underline underline-offset-4">contact page</Link>.
          Read our <Link href="/privacy" className="text-accent underline underline-offset-4">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
