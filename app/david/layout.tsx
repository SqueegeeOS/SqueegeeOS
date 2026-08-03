import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "David's Field Desk · HomeAtlas",
  description: "David's private HomeAtlas field sales workspace.",
  manifest: "/api/sales-manifest/david",
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "David Field",
  },
};

export const viewport: Viewport = {
  themeColor: "#090806",
  colorScheme: "dark",
};

export default function DavidLayout({ children }: { children: ReactNode }) {
  return children;
}
