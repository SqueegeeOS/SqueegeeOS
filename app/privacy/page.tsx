import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How SqueegeeKing and HomeAtlas handle website and Google review data.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-24 text-foreground sm:py-32">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">
        Effective August 2, 2026
      </p>
      <h1 className="mt-4 font-serif text-5xl font-light">Privacy Policy</h1>
      <div className="mt-10 space-y-8 text-sm leading-7 text-muted sm:text-base">
        <p>
          SqueegeeKing uses HomeAtlas to receive service requests, maintain
          customer records, and operate this website. We collect information
          you submit, such as your name, contact details, property information,
          requested services, and communication preferences, so we can answer
          you and provide service.
        </p>

        <section>
          <h2 className="font-serif text-2xl text-foreground">Google services</h2>
          <p className="mt-3">
            Our site uses Google Maps Platform, Places, and an owner-authorized
            Google Business Profile connection. Google review information may
            include an author name, rating, comment, publication date, profile
            photo or profile link, and a link to the original review. We use
            that information only to identify our business and present its
            reviews with Google attribution.
          </p>
          <p className="mt-3">
            Places review previews are requested live and are not stored by us.
            Owner-authorized Business Profile review responses may be cached
            temporarily on our server; the site does not display a cached
            response older than 24 hours. OAuth credentials are encrypted,
            restricted to private server access, and removed or disabled when
            the connection is disconnected.
          </p>
          <p className="mt-3">
            Google processes information under the{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-4"
            >
              Google Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">Sharing and retention</h2>
          <p className="mt-3">
            We use service providers such as hosting, database, email, text
            messaging, scheduling, analytics, and payment providers only as
            needed to operate the business. We do not sell personal
            information. We retain customer records as needed to provide
            service, meet legal obligations, resolve disputes, and maintain the
            history customers expect in HomeAtlas.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">Your choices</h2>
          <p className="mt-3">
            You may ask to review, correct, or delete information you provided,
            subject to records we must keep. You can also opt out of marketing
            messages using the instructions in the message or by contacting us.
          </p>
        </section>

        <p>
          Questions? Use our <Link href="/contact" className="text-accent underline underline-offset-4">contact page</Link>.
          See also our <Link href="/terms" className="text-accent underline underline-offset-4">Terms of Use</Link>.
        </p>
      </div>
    </main>
  );
}
