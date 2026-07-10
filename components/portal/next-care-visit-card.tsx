import type { PortalNextCareVisit } from "@/lib/membership/portal-next-care-visit";
import { PortalCard } from "@/components/portal/portal-section";

export function NextCareVisitCard({
  visit,
}: {
  visit: PortalNextCareVisit;
}) {
  if (visit.hasScheduledVisit) {
    return (
      <PortalCard className="space-y-4">
        <p className="font-serif text-xl text-foreground sm:text-2xl">
          {visit.dateLabel}
        </p>
        {visit.timeWindow ? (
          <p className="text-sm text-foreground/70">
            <span className="text-[10px] uppercase tracking-[0.2em] text-accent/80">
              Service window
            </span>
            <span className="mt-1 block">{visit.timeWindow}</span>
          </p>
        ) : null}
        <p className="text-sm text-foreground/80">{visit.serviceTypeLabel}</p>
        <p className="border-t border-border pt-4 text-sm leading-relaxed text-foreground/60">
          {visit.reassuranceCopy}
        </p>
      </PortalCard>
    );
  }

  return (
    <PortalCard className="text-center">
      <p className="text-sm leading-relaxed text-foreground/65">
        {visit.emptyCopy}
      </p>
    </PortalCard>
  );
}
