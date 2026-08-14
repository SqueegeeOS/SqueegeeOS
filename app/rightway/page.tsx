import type { Metadata } from "next";
import { Day2Homepage } from "@/components/marketing/day2-homepage";

export const metadata: Metadata = {
  title: "The Right Way — SqueegeeKing Homepage Study",
  description:
    "The preserved SqueegeeKing homepage experience for private design comparison.",
  alternates: { canonical: "/rightway" },
  robots: { index: false, follow: false },
};

/** Preserve the prior homepage so the owner can compare both directions. */
export default function RightWayPage() {
  return <Day2Homepage />;
}
