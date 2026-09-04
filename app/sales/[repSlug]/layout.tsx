import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ repSlug: string }>;
}): Promise<Metadata> {
  const { repSlug } = await params;
  return {
    title: "Field Desk · HomeAtlas",
    manifest: `/api/sales-manifest/${encodeURIComponent(repSlug)}`,
    robots: { index: false, follow: false, nocache: true },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "HomeAtlas Field",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#090806",
  colorScheme: "dark",
};

export default function SalesRepLayout({ children }: { children: ReactNode }) {
  return (
    <div className="atlas-role-shell min-h-[100svh]" data-atlas-theme="lux">
      {children}
    </div>
  );
}
