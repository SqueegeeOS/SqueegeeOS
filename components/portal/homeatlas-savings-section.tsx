import type { MemberSavingsLedgerView } from "@/lib/membership/member-savings-ledger";
import { formatLedgerLineDate } from "@/lib/membership/member-savings-ledger";
import { PortalCard } from "@/components/portal/portal-section";

function LedgerCategoryBlock({
  category,
}: {
  category: MemberSavingsLedgerView["membershipVisits"];
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-serif text-lg text-foreground">{category.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/55">
          {category.support}
        </p>
        {category.total > 0 ? (
          <p className="mt-3 text-sm font-medium text-accent/90">
            {category.total.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}{" "}
            saved
          </p>
        ) : null}
      </div>

      {category.lines.length > 0 ? (
        <ul className="space-y-3 border-t border-border pt-4">
          {category.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-start justify-between gap-4 text-sm"
            >
              <div className="min-w-0">
                <p className="text-foreground/85">{line.label}</p>
                <p className="mt-1 text-foreground/45">
                  {formatLedgerLineDate(line.occurredAt)}
                </p>
                {line.detail ? (
                  <p className="mt-1 text-foreground/50">{line.detail}</p>
                ) : null}
              </div>
              <p className="shrink-0 font-medium text-foreground/80">
                {line.amount.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-border pt-4 text-sm text-foreground/45">
          No entries yet — savings appear here from real completed visits and
          add-ons.
        </p>
      )}
    </div>
  );
}

export function HomeAtlasSavingsSection({
  ledger,
}: {
  ledger: MemberSavingsLedgerView;
}) {
  if (!ledger.hasAnySavings) {
    return (
      <PortalCard className="text-center">
        <p className="text-sm leading-relaxed text-foreground/60">
          Your HomeAtlas savings ledger begins with your first completed visit or
          member add-on.
        </p>
      </PortalCard>
    );
  }

  return (
    <div className="space-y-6">
      <PortalCard className="text-center">
        <p className="text-[10px] uppercase tracking-[0.32em] text-accent/85">
          Your HomeAtlas Savings
        </p>
        <p className="mt-4 font-serif text-4xl font-light tracking-[-0.02em] text-foreground sm:text-5xl">
          {ledger.totalServiceSavingsLabel}
        </p>
        <p className="mt-3 text-sm text-foreground/55">saved so far</p>
        <p className="mt-4 text-xs leading-relaxed text-foreground/45">
          Service discounts only — referral Care Credits are tracked separately
          below.
        </p>
      </PortalCard>

      <PortalCard>
        <LedgerCategoryBlock category={ledger.membershipVisits} />
      </PortalCard>

      <PortalCard>
        <LedgerCategoryBlock category={ledger.addonServices} />
      </PortalCard>
    </div>
  );
}
