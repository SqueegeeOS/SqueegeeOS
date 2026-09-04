import type { Metadata } from "next";
import { TechnicianReferralForm } from "@/components/field/technician-referral-form";
import { requireFieldPageActor } from "@/lib/field-operations/field-access-dal";

export const metadata: Metadata = {
  title: "Refer a Customer | Technician",
};

export default async function TechnicianReferralPage() {
  const actor = await requireFieldPageActor("/tech/refer");
  return (
    <main className="mx-auto min-h-[100svh] max-w-lg px-4 pb-32 pt-8 sm:px-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#d9bd82]">HomeAtlas · Crew</p>
        <h1 className="mt-3 font-serif text-4xl font-light tracking-[-0.04em] text-[#f8f3e8]">Send HQ a warm lead.</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
          Add the basics. Noah or Dasan takes it from here, and HomeAtlas keeps your name attached through the sale.
        </p>
      </header>
      <TechnicianReferralForm
        technicianName={actor.kind === "technician" ? actor.displayName : "Technician preview"}
        previewOnly={actor.kind === "admin"}
      />
    </main>
  );
}
