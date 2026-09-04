import type { Metadata } from "next";
import { TechnicianAccessPage } from "@/components/admin/technician-access-page";

export const metadata: Metadata = {
  title: "Technicians | HomeAtlas HQ",
  description: "Manage persistent, least-privilege HomeAtlas technician access.",
  robots: { index: false, follow: false },
};

export default function HqTechniciansPage() {
  return <TechnicianAccessPage />;
}
