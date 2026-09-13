import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LeadTechnicianSuite } from "@/components/field/lead-technician-suite";
import {
  homeAtlasTechnicianId,
} from "@/lib/field-operations/field-access";
import { requireFieldPageActor } from "@/lib/field-operations/field-access-dal";
import { loadTechnicianOperationalProfile } from "@/lib/field-operations/technician-profile-server";

export const metadata: Metadata = {
  title: "Lead Technician Suite | HomeAtlas",
  description: "Private field command center for the SqueegeeKing lead technician.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TechnicianSuitePage() {
  const actor = await requireFieldPageActor("/tech/suite");
  if (actor.kind !== "technician") redirect("/tech");

  const technicianId = homeAtlasTechnicianId(actor.jobberUserId);
  if (!technicianId) redirect("/tech");

  const profile = await loadTechnicianOperationalProfile(technicianId);
  if (!profile || profile.technician.displayName !== actor.displayName) {
    redirect("/tech");
  }

  return <LeadTechnicianSuite profile={profile} />;
}
