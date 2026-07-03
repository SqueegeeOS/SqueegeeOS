import type { Metadata } from "next";
import { ExperienceGate } from "@/components/experience/experience-gate";

export const metadata: Metadata = {
  title: "Experience Lab | SqueegeeKing",
  description: "Internal animation preview lab for SqueegeeKing founders.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ExperienceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ExperienceGate>{children}</ExperienceGate>;
}
