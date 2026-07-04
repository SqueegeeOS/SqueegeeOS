import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Present mode uses fixed overlay — hide global chrome padding */
export default function PresentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
