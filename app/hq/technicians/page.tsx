import type { Metadata } from "next";
import { TechnicianHubPage } from "@/components/admin/technician-hub-page";

export const metadata: Metadata = {
  title: "Technicians | HomeAtlas HQ",
  description: "Manage persistent, least-privilege HomeAtlas technician access and operational staff profiles.",
  robots: { index: false, follow: false },
};

export default function HqTechniciansPage() {
  return <TechnicianHubPage />;
}
