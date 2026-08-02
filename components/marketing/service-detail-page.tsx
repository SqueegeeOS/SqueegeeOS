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
  ).slice(0, 3);

  return (
    <main className="min-h-screen bg-[#f5f0e6] text-[#173f32]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildServiceJsonLd(service)),
        }}
      />

      <section className="px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-36 lg:px-12">
        <div className="mx-auto grid max-w-[90rem] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#526b60]"
            >
              <Link href="/" className="hover:text-[#99683d]">
                Home
              </Link>
              <span aria-hidden>/</span>
              <Link href="/services" className="hover:text-[#99683d]">
                Services
              </Link>
              <span aria-hidden>/</span>
              <span aria-current="page" className="text-[#99683d]">
                {service.name}
              </span>
            </nav>

            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.3em] text-[#8f5f37]">
              {service.pageTitle}
            </p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl font-light leading-[0.94] sm:text-7xl lg:text-[5.8rem]">
              {service.headline}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[#526b60] sm:text-xl">
              {service.description}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#173f32] px-8 text-sm font-medium tracking-[0.08em] text-[#fffaf0] transition-transform hover:-translate-y-0.5"
              >
                Request my plan
              </Link>
              <a
                href={LOCAL_CONTACT.phoneHref}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#173f32]/15 bg-white/45 px-8 text-sm font-medium text-[#173f32] transition-colors hover:border-[#99683d]/40"
              >
                Call {LOCAL_CONTACT.phoneDisplay}
              </a>
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-[#173f32]/10 bg-[#e7ecdf] shadow-[0_32px_90px_-55px_rgba(23,63,50,0.55)] sm:aspect-[5/4] lg:aspect-[4/5]">
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
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#8f5f37]">
                Care rhythm
              </p>
              <p className="mt-2 font-serif text-2xl font-light">
                {service.rhythm}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#173f32]/10 bg-[#fffdf8] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto max-w-[90rem]">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8f5f37]">
            What your plan can include
          </p>
          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {service.inclusions.map((item, index) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-[#173f32]/10 bg-[#f5f0e6] p-7 sm:p-8"
              >
                <p className="font-mono text-xs text-[#99683d]">
                  0{index + 1}
                </p>
                <h2 className="mt-7 font-serif text-3xl font-light">
                  {item.title}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[#526b60] sm:text-base">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-[90rem] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8f5f37]">
              The SqueegeeKing standard
            </p>
            <h2 className="mt-5 font-serif text-5xl font-light leading-[0.98] sm:text-6xl">
              A clear plan before anyone arrives.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[#526b60]">
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
                className="grid grid-cols-[auto_1fr] gap-5 rounded-[1.5rem] border border-[#173f32]/10 bg-white/45 p-6 sm:p-7"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f32] font-mono text-xs text-[#fffaf0]">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-serif text-2xl font-light">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#526b60] sm:text-base">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-[#173f32]/10 bg-[#e7ecdf] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[90rem]">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8f5f37]">
                Explore the whole exterior
              </p>
              <h2 className="mt-4 font-serif text-4xl font-light sm:text-5xl">
                Related home care services
              </h2>
            </div>
            <Link
              href="/services"
              className="text-sm underline decoration-[#99683d]/35 underline-offset-4 hover:text-[#99683d]"
            >
              View all services
            </Link>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {relatedServices.map((related) => (
              <Link
                key={related.slug}
                href={`/services/${related.slug}`}
                className="group rounded-[1.25rem] border border-[#173f32]/10 bg-[#fffdf8] p-6 transition-transform hover:-translate-y-1"
              >
                <p className="font-serif text-2xl font-light">
                  {related.name}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#526b60]">
                  {related.metaDescription}
                </p>
                <span className="mt-6 inline-block text-sm text-[#99683d]">
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
