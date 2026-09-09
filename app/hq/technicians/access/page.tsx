import type { Metadata } from "next";
import { TechnicianAccessPage } from "@/components/admin/technician-access-page";

export const metadata: Metadata = {
  title: "Technician Access & Training | HomeAtlas HQ",
  description:
    "Advanced technician access, historical readiness evidence, and capacity controls.",
  robots: { index: false, follow: false },
};

export default function TechnicianAccessArchivePage() {
  return <TechnicianAccessPage />;
}
