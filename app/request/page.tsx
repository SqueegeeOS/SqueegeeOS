import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/marketing/page-metadata";
import { RequestForm } from "@/components/acquisition/request-form";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Request a Free Cleaning Quote in Chico, CA",
  description:
    "Request a free quote from SqueegeeKing for window cleaning, gutters, pressure washing, solar panels, or recurring home care in Chico, CA.",
  path: "/request",
});

export default function RequestPage() {
  return <RequestForm />;
}
