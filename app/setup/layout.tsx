import type { Metadata } from "next";
import { SetupGate } from "@/components/setup/setup-gate";

export const metadata: Metadata = {
  title: "Google Reviews Setup | SqueegeeKing",
  robots: { index: false, follow: false },
};

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SetupGate>{children}</SetupGate>;
}
