import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import { HOMEOWNER_GUIDES, getHomeownerGuide } from "@/lib/marketing/homeowner-guides";
import { getPublicService } from "@/lib/marketing/public-services";
import { serializeJsonLd } from "@/lib/marketing/local-seo";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return HOMEOWNER_GUIDES.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getHomeownerGuide((await params).slug);
  if (!guide) return {};
  const canonical = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical },
    openGraph: { title: `${guide.title} | SqueegeeKing`, description: guide.description, url: canonical, type: "article" },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description, images: ["/atlas-glass/hero-house-wide.png"] },
  };
}

export default async function GuidePage({ params }: Props) {
  const guide = getHomeownerGuide((await params).slug);
  if (!guide) notFound();
  const service = getPublicService(guide.serviceSlug);
  const url = `${PUBLIC_SITE_URL}/guides/${guide.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", "@id": `${url}/#article`, headline: guide.title, description: guide.description, url, mainEntityOfPage: url, author: { "@type": "Organization", name: "SqueegeeKing", url: PUBLIC_SITE_URL }, publisher: { "@id": `${PUBLIC_SITE_URL}/#business` }, inLanguage: "en-US" },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: PUBLIC_SITE_URL },
        { "@type": "ListItem", position: 2, name: "Home care guides", item: `${PUBLIC_SITE_URL}/guides` },
        { "@type": "ListItem", position: 3, name: guide.title, item: url },
      ] },
    ],
  };
  return (
    <main className="min-h-screen bg-[#f5f0e6] px-5 pb-24 pt-32 text-[#173f32] sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-3 text-sm text-[#526b60]"><Link href="/">Home</Link><span aria-hidden>/</span><Link href="/guides">Home care guides</Link></nav>
        <h1 className="mt-8 font-serif text-5xl font-light leading-tight sm:text-6xl">{guide.title}</h1>
        <p className="mt-6 text-xl leading-relaxed text-[#526b60]">{guide.description}</p>
        <p className="mt-6 text-sm text-[#526b60]">By SqueegeeKing · Chico, California</p>
        {guide.sections.map((section) => (
          <section key={section.title} className="mt-12">
            <h2 className="font-serif text-3xl">{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-5 text-lg leading-relaxed text-[#526b60]">{paragraph}</p>)}
          </section>
        ))}
        <aside className="mt-14 rounded-3xl bg-[#e7ecdf] p-7 sm:p-10">
          <h2 className="font-serif text-3xl">Tell us what your home needs.</h2>
          <div className="mt-6 flex flex-wrap gap-6"><Link href="/request" className="font-medium underline underline-offset-4">Get a free quote →</Link>{service ? <Link href={`/services/${service.slug}`} className="underline underline-offset-4">Explore {service.navLabel}</Link> : null}</div>
        </aside>
      </article>
    </main>
  );
}
