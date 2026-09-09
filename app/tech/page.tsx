import type { Metadata } from "next";
import { TechnicianJobberSyncButton } from "@/components/field/technician-jobber-sync-button";
import { TechnicianTodayWorkspace } from "@/components/field/technician-today-workspace";
import { requireFieldPageActor } from "@/lib/field-operations/field-access-dal";

export const metadata: Metadata = {
  title: "Field Run | Technician",
};

export default async function TechHomePage() {
  const actor = await requireFieldPageActor("/tech");
  return (
    <>
      <TechnicianTodayWorkspace
        actorKind={actor.kind}
        actorDisplayName={actor.displayName}
      />
      {actor.kind === "technician" ? <TechnicianJobberSyncButton /> : null}
    </>
  );
}
