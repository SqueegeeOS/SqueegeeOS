import type { ReactNode } from "react";
import { Caveat } from "next/font/google";
import "@/components/home-care-plan/plan.css";

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export default function GeneratedHomeCarePlanLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={`${caveat.variable} plan-root`}>{children}</div>;
}
