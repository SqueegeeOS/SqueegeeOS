import type { Metadata } from "next";
import { TechnicianProfilePage } from "@/components/admin/technician-profile-page";

export const metadata: Metadata = {
  title: "Technician Profile | HomeAtlas HQ",
  description: "Private HomeAtlas technician operational profile.",
  robots: { index: false, follow: false },
};

export default async function HqTechnicianProfileRoute({
  params,
}: {
  params: Promise<{ technicianId: string }>;
}) {
  const { technicianId } = await params;
  return <TechnicianProfilePage technicianId={technicianId} />;
}
