import type { Metadata } from "next";
import { PortalWelcomeHome } from "@/components/pwa/PortalWelcomeHome";
import { platformPageTitle } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: platformPageTitle("Welcome Home"),
  robots: { index: false, follow: false },
};

interface PortalWelcomePageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalWelcomePage({
  params,
}: PortalWelcomePageProps) {
  const { token } = await params;
  return <PortalWelcomeHome token={token} />;
}
