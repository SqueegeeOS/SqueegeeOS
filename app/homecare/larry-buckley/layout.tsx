import type { ReactNode } from "react";
import "./homecare.css";

export default function HomecareLayout({ children }: { children: ReactNode }) {
  return <div className="homecare-root">{children}</div>;
}
