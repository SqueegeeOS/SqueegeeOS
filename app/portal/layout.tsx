import type { ReactNode } from "react";

export default function PortalRootLayout({ children }: { children: ReactNode }) {
  return <div className="portal-safe-area min-h-[100svh]">{children}</div>;
}
