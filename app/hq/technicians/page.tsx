import type { Metadata } from "next";
import { TechnicianAccessPage } from "@/components/admin/technician-access-page";

export const metadata: Metadata = {
  title: "Team Field Access | HomeAtlas HQ",
  description: "Issue and revoke least-privilege HomeAtlas Field Passes.",
  robots: { index: false, follow: false },
};

export default function HqTechniciansPage() {
  return <TechnicianAccessPage />;
}
