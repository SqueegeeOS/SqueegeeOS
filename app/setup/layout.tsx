import type { Metadata } from "next";
import { SetupGate } from "@/components/setup/setup-gate";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Google Reviews Setup | SqueegeeKing`,
  description: `Connect live Google reviews for SqueegeeKing on ${PLATFORM_BRAND.name}.`,
  robots: { index: false, follow: false },
};

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SetupGate>{children}</SetupGate>;
}
