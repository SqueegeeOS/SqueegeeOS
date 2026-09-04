import type { Metadata, Viewport } from "next";
import { TechnicianPortalDock } from "@/components/field/technician-portal-dock";

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
    <div className="min-h-[100svh] bg-[#08100d] text-white">
      {children}
      <TechnicianPortalDock />
    </div>
  );
}
