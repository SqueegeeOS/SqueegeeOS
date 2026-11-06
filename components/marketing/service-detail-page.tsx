import Image from "next/image";
import Link from "next/link";
import {
  buildServiceJsonLd,
  LOCAL_CONTACT,
  serializeJsonLd,
} from "@/lib/marketing/local-seo";
import {
  PUBLIC_SERVICES,
  type PublicService,
} from "@/lib/marketing/public-services";

export function ServiceDetailPage({ service }: { service: PublicService }) {
  const relatedServices = PUBLIC_SERVICES.filter(
    (candidate) => candidate.slug !== service.slug,
  );

  return (
    <main className="customer-theme min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildServiceJsonLd(service)),
        }}
      />

      <section className="px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-36 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted"
            >
              <Link href="/" className="hover:text-accent">
                Home
              </Link>
              <span aria-hidden>/</span>
              <Link href="/services" className="hover:text-accent">
                Services
              </Link>
              <span aria-hidden>/</span>
              <span aria-current="page" className="text-accent">
                {service.name}
              </span>
            </nav>

            <p className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-accent">
              {service.pageTitle}
            </p>
            <h1 className="mt-5 max-w-4xl text-balance font-serif text-5xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl">
              {service.headline}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              {service.description}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request"
                className="customer-button-primary"
              >
                Get your free quote
              </Link>
              <a
                href={LOCAL_CONTACT.phoneHref}
                className="customer-button-secondary"
              >
                Call {LOCAL_CONTACT.phoneDisplay}
              </a>
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-border bg-[var(--surface-elevated)] shadow-[0_32px_90px_-55px_rgba(23,63,50,0.55)] sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src={service.image}
              alt={service.imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 92vw"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[#173f32]/35 via-transparent to-white/10"
            />
            <div className="absolute inset-x-5 bottom-5 rounded-[1.25rem] border border-white/45 bg-[#fffaf0]/88 p-5 shadow-xl backdrop-blur-md sm:inset-x-7 sm:bottom-7">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
                Care rhythm
              </p>
              <p className="mt-2 font-serif text-2xl font-light">
                {service.rhythm}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
            What your plan can include
          </p>
          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {service.inclusions.map((item, index) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-border bg-background p-7 sm:p-8"
              >
                <p className="font-mono text-xs text-accent">
                  0{index + 1}
                </p>
                <h2 className="mt-7 font-serif text-3xl font-light">
                  {item.title}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {service.pricing && (
        <section className="border-b border-border bg-[var(--surface-elevated)] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-4xl font-light sm:text-5xl">{service.pricing.heading}</h2>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">{service.pricing.description}</p>
            </div>
            <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-muted">
              {service.pricing.factors.map((factor) => <li key={factor}>{factor}</li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
              The SqueegeeKing standard
            </p>
            <h2 className="mt-5 text-balance font-serif text-4xl font-medium leading-[1.08] sm:text-5xl">
              A clear plan before anyone arrives.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              {service.promise}
            </p>
          </div>

          <ol className="grid gap-4">
            {[
              [
                "Tell us about the property",
                "Share the address, the care you are considering, and the best way to reach you.",
              ],
              [
                "Review your Home Care Plan",
                "We turn the scope and rhythm into a plan you can understand before making a decision.",
              ],
              [
                "Choose one-time or recurring care",
                "Book the visit that fits now, or let a 3- or 6-month membership keep the calendar handled.",
              ],
            ].map(([title, description], index) => (
              <li
                key={title}
                className="grid grid-cols-[auto_1fr] gap-5 rounded-[1.5rem] border border-border bg-white/45 p-6 sm:p-7"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground font-mono text-xs text-background">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-serif text-2xl font-light">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border bg-surface px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
            Answers before you book
          </p>
          <h2 className="mt-5 max-w-4xl font-serif text-4xl font-light leading-tight sm:text-5xl">
            {service.name} questions from Chico homeowners
          </h2>
          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {service.questions.map(({ question, answer }) => (
              <article
                key={question}
                className="rounded-[1.5rem] border border-border bg-background p-7 sm:p-8"
              >
                <h3 className="font-serif text-2xl font-light">{question}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                  {answer}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-9 max-w-3xl text-sm leading-relaxed text-muted">
            Based in Chico, California. For properties in Oroville, Magalia,
            or Lake Almanor, share your address so we can confirm travel and
            scheduling availability before quoting the work.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-[var(--surface-elevated)] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
                Explore the whole exterior
              </p>
              <h2 className="mt-4 font-serif text-4xl font-light sm:text-5xl">
                Related home care services
              </h2>
            </div>
            <Link
              href="/services"
              className="text-sm underline decoration-accent/40 underline-offset-4 hover:text-accent"
            >
              View all services
            </Link>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {relatedServices.map((related) => (
              <Link
                key={related.slug}
                href={`/services/${related.slug}`}
                className="group rounded-[1.25rem] border border-border bg-surface p-6 outline-none transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transform-none motion-reduce:transition-none"
              >
                <p className="font-serif text-2xl font-light">
                  {related.name}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {related.metaDescription}
                </p>
                <span className="mt-6 inline-block text-sm text-accent">
                  Learn more <span aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
