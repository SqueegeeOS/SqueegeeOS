import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  buildServicesIndexJsonLd,
  LOCAL_CONTACT,
  serializeJsonLd,
} from "@/lib/marketing/local-seo";
import { PUBLIC_SERVICES } from "@/lib/marketing/public-services";

export const metadata: Metadata = {
  title: "Window Cleaning & Exterior Home Care in Chico, CA",
  description:
    "Explore SqueegeeKing window cleaning, pressure washing, solar panel cleaning, and recurring exterior home care for Chico, California homeowners.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Exterior Home Care Services in Chico, CA | SqueegeeKing",
    description:
      "Window cleaning, pressure washing, solar panel cleaning, and recurring care built around your Chico home.",
    url: "/services",
    type: "website",
    images: [
      {
        url: "/day/hour-window.jpg",
        width: 1376,
        height: 768,
        alt: "SqueegeeKing exterior home care in Chico, California",
      },
    ],
  },
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#f5f0e6] text-[#173f32]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildServicesIndexJsonLd()),
        }}
      />

      <section className="px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-36 lg:px-12">
        <div className="mx-auto max-w-[90rem]">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8f5f37]">
            Chico, California · Exterior home care
          </p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <h1 className="max-w-5xl font-serif text-6xl font-light leading-[0.9] sm:text-8xl lg:text-[7.2rem]">
              Four crafts.
              <br />
              <em className="text-[#99683d]">One standard.</em>
            </h1>
            <div className="pb-2">
              <p className="max-w-xl text-lg leading-relaxed text-[#526b60]">
                Window cleaning, pressure washing, solar panel care, and
                recurring maintenance shaped around the property—not a generic
                package.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/request"
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#173f32] px-8 text-sm font-medium tracking-[0.08em] text-[#fffaf0]"
                >
                  Request my plan
                </Link>
                <a
                  href={LOCAL_CONTACT.phoneHref}
                  className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#173f32]/15 px-7 text-sm font-medium"
                >
                  {LOCAL_CONTACT.phoneDisplay}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#173f32]/10 bg-[#fffdf8] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto grid max-w-[90rem] gap-5 md:grid-cols-2">
          {PUBLIC_SERVICES.map((service, index) => (
            <article
              key={service.slug}
              className="group overflow-hidden rounded-[1.75rem] border border-[#173f32]/10 bg-[#f5f0e6] shadow-[0_24px_70px_-55px_rgba(23,63,50,0.5)]"
            >
              <Link href={`/services/${service.slug}`} className="block">
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
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#99683d]">
                        0{index + 1}
                      </p>
                      <h2 className="mt-3 font-serif text-4xl font-light">
                        {service.name}
                      </h2>
                    </div>
                    <span
                      aria-hidden
                      className="mt-2 text-2xl text-[#99683d] transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </div>
                  <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#526b60] sm:text-base">
                    {service.description}
                  </p>
                  <p className="mt-5 border-t border-[#173f32]/10 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[#526b60]">
                    {service.rhythm}
                  </p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-[90rem] gap-10 rounded-[2rem] border border-[#173f32]/10 bg-[#e7ecdf] p-7 sm:p-12 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8f5f37]">
              Every membership includes HomeAtlas
            </p>
            <h2 className="mt-5 max-w-3xl font-serif text-5xl font-light leading-[0.96] sm:text-6xl">
              Your home should not have to explain itself twice.
            </h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-[#526b60]">
              HomeAtlas keeps upcoming care, visits, observations, photos,
              documents, and membership details connected to the property.
            </p>
            <Link
              href="/services/home-care-memberships"
              className="mt-7 inline-flex text-sm font-medium text-[#99683d] underline decoration-[#99683d]/30 underline-offset-4"
            >
              Explore recurring home care
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
