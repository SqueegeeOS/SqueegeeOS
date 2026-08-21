import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function HeadquartersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="hq-mobile-shell min-w-0 max-w-full overflow-x-clip">
      {children}
    </div>
  );
}
