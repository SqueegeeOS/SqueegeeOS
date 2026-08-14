import type { ReactNode } from "react";
import "@/components/home-care-plan/plan.css";

export default function HomeCarePlanLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="plan-root">{children}</div>;
}
