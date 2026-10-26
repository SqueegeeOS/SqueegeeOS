import type { Metadata } from "next";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";

export interface PublicPageMetadataInput {
  /** Page title without the shared brand suffix. */
  title: string;
  description: string;
  path: string;
  image?: {
    url: string;
    width: number;
    height: number;
    alt: string;
  };
}

const DEFAULT_SHARE_IMAGE = {
  url: "/atlas-glass/hero-house-wide.png",
  width: 1672,
  height: 941,
  alt: "A cared-for home illustrated with its HomeAtlas care record",
};

/**
 * Next metadata objects are shallow-merged between route segments. Always
 * provide both social-card objects so a service or policy never inherits the
 * homepage's Twitter title, image, or Open Graph URL.
 */
export function buildPublicPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_SHARE_IMAGE,
}: PublicPageMetadataInput): Metadata {
  const fullTitle = `${title} | ${CUSTOMER_BRAND.name}`;

  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: CUSTOMER_BRAND.name,
      title: fullTitle,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
