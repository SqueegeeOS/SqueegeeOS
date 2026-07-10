import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  // Generic portal manifest; /portal/[token] overrides with its own.
  manifest: "/api/portal-manifest/portal",
};

export default function PortalRootLayout({ children }: { children: ReactNode }) {
  return <div className="portal-safe-area min-h-[100svh]">{children}</div>;
}
