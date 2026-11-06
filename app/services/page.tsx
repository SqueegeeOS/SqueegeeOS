import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/marketing/page-metadata";
import Image from "next/image";
import Link from "next/link";
import {
  buildServicesIndexJsonLd,
  LOCAL_CONTACT,
  serializeJsonLd,
} from "@/lib/marketing/local-seo";
import { PUBLIC_SERVICES } from "@/lib/marketing/public-services";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Exterior Cleaning Services in Chico, CA",
  description:
    "Explore SqueegeeKing window cleaning, gutter cleaning, pressure washing, solar panel cleaning, and recurring exterior home care for Chico, California homeowners.",
  path: "/services",
  image: {
    url: "/day/hour-window.jpg",
    width: 1376,
    height: 768,
    alt: "Window cleaning and exterior home care",
  },
});

export default function ServicesPage() {
  return (
    <main className="customer-theme min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildServicesIndexJsonLd()),
        }}
      />

      <section className="px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-36 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
            Chico, California · Exterior home care
          </p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <h1 className="max-w-5xl text-balance font-serif text-5xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl">
              Exterior Cleaning
              <br />
              <em className="text-accent">in Chico, CA.</em>
            </h1>
            <div className="pb-2">
              <p className="max-w-xl text-lg leading-relaxed text-muted">
                Window cleaning, gutter cleaning, pressure washing, solar panel
                cleaning, and recurring maintenance for Chico homeowners.
                Choose the services your property needs in one clear quote.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
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
                  {LOCAL_CONTACT.phoneDisplay}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {PUBLIC_SERVICES.map((service, index) => (
            <article
              key={service.slug}
              className="group overflow-hidden rounded-[1.75rem] border border-border bg-background shadow-[0_24px_70px_-55px_rgba(23,63,50,0.5)] focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-4 focus-within:ring-offset-background"
            >
              <Link href={`/services/${service.slug}`} className="block rounded-[1.75rem] outline-none">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={service.image}
                    alt={service.imageAlt}
                    fill
                    sizes="(min-width: 768px) 46vw, 92vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#173f32]/35 via-transparent to-transparent"
                  />
                </div>
                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
                        0{index + 1}
                      </p>
                      <h2 className="mt-3 font-serif text-4xl font-light">
                        {service.name}
                      </h2>
                    </div>
                    <span
                      aria-hidden
                      className="mt-2 text-2xl text-accent transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </div>
                  <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                    {service.description}
                  </p>
                  <p className="mt-5 border-t border-border pt-4 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    {service.rhythm}
                  </p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] border border-border bg-[var(--surface-elevated)] p-7 sm:p-12 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
              Every membership includes HomeAtlas
            </p>
            <h2 className="mt-5 max-w-3xl text-balance font-serif text-4xl font-medium leading-[1.08] sm:text-5xl">
              Your home should not have to explain itself twice.
            </h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-muted">
              HomeAtlas keeps upcoming care, visits, observations, photos,
              documents, and membership details connected to the property.
            </p>
            <Link
              href="/services/home-care-memberships"
              className="mt-7 inline-flex text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4"
            >
              Explore recurring home care
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
