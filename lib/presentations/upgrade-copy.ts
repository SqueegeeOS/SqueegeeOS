import { formatDollars } from "@/lib/pricing/format";
import type { quarterlyUpgradeMath } from "@/lib/membership/tier-config";

type UpgradeMath = ReturnType<typeof quarterlyUpgradeMath>;

export function quarterlyUpgradeSummary(
  upgrade: UpgradeMath,
): string {
  const treatment = formatDollars(upgrade.includedTreatmentValue);
  const extra = formatDollars(upgrade.upgradeCost);
  const biannual = formatDollars(upgrade.biannualAnnual);
  const quarterly = formatDollars(upgrade.quarterlyAnnual);

  if (upgrade.netAdvantage > 0) {
    return (
      `Quarterly includes ${treatment}/year in added RainBlock + Hard Water treatment value at retail. ` +
      `Bi-Annual is ${biannual}/year. Quarterly is ${quarterly}/year — ${extra}/year more than Bi-Annual. ` +
      `The included treatments more than offset the added plan cost.`
    );
  }

  return (
    `Quarterly includes ${treatment}/year in added RainBlock + Hard Water treatment value at retail. ` +
    `Bi-Annual is ${biannual}/year. Quarterly is ${quarterly}/year — ${extra}/year more than Bi-Annual.`
  );
}

export function quarterlySavingsLine(upgrade: UpgradeMath): string | null {
  if (upgrade.netAdvantage <= 0) return null;
  return `You save approximately ${formatDollars(upgrade.netAdvantage)}/year by choosing Quarterly over paying for these treatments separately.`;
}

export function quarterlyComplimentaryLine(upgrade: UpgradeMath): string {
  const value = formatDollars(upgrade.includedTreatmentValue);
  const lead = upgrade.netAdvantage > 0 ? "Plus, you receive" : "You receive";
  return `${lead} ${value}/year in complimentary services, including RainBlock Technology, Hard Water Removal, and other included treatment benefits.`;
}

export function quarterlyNetAdvantageLine(upgrade: UpgradeMath): string {
  if (upgrade.netAdvantage <= 0) {
    return "Treatments are included with Quarterly membership.";
  }
  return `${formatDollars(upgrade.netAdvantage)} in added treatment value beyond the upgrade cost`;
}
