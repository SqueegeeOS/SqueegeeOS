import type { Metadata } from "next";
import { MemberPortalNotFound } from "../member-portal-page-client";

export const metadata: Metadata = {
  title: "Home Health | Member Portal",
  robots: { index: false, follow: false },
};

interface MemberHomeHealthPageProps {
  params: Promise<{
    homeownerSlug: string;
    propertySlug: string;
  }>;
}

export default async function MemberHomeHealthPage({
  params,
}: MemberHomeHealthPageProps) {
  await params;
  return <MemberPortalNotFound />;
}
