import type { PortalCareAddonEntry } from "@/lib/membership/portal-care-addons";
import { PortalCard } from "@/components/portal/portal-section";

export function CareAddonsSection({
  addons,
}: {
  addons: PortalCareAddonEntry[];
}) {
  if (addons.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-4">
      {addons.map((addon) => (
        <li key={addon.id}>
          <PortalCard className="space-y-2">
            <p className="font-serif text-lg text-foreground">
              {addon.serviceName}
            </p>
            <p className="text-sm text-foreground/60">{addon.dateLabel}</p>
            <p className="text-sm text-foreground/85">{addon.amountPaidLabel}</p>
            {addon.savingsLabel ? (
              <p className="text-sm text-accent/90">{addon.savingsLabel}</p>
            ) : null}
          </PortalCard>
        </li>
      ))}
    </ul>
  );
}
