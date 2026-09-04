import type { Metadata, Viewport } from "next";
import { TechnicianPortalDock } from "@/components/field/technician-portal-dock";

export const metadata: Metadata = {
  title: "Technician",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#070605",
  colorScheme: "dark",
};

export default function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="atlas-role-shell min-h-[100svh] text-foreground">
      {children}
      <TechnicianPortalDock />
    </div>
  );
}
