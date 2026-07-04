import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Technician",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100svh] bg-[#0a0a0a] text-white">{children}</div>
  );
}
