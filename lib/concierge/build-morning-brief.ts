import {
  CONCIERGE_RULES,
  hasEnoughConciergeData,
} from "./rules";
import type {
  ConciergeProvider,
  MorningBrief,
  MorningBriefInput,
} from "./types";
import {
  MORNING_BRIEF_FALLBACK_MESSAGE,
  MORNING_BRIEF_MAX_INSIGHTS,
  MORNING_BRIEF_MIN_INSIGHTS,
} from "./types";

export function buildMorningBrief(input: MorningBriefInput): MorningBrief {
  const hasEnoughData = hasEnoughConciergeData(input);

  if (!hasEnoughData) {
    return {
      generatedAt: new Date().toISOString(),
      insights: [],
      fallbackMessage: MORNING_BRIEF_FALLBACK_MESSAGE,
      hasEnoughData: false,
    };
  }

  const insights = CONCIERGE_RULES.map((rule) => rule(input))
    .filter((insight): insight is NonNullable<typeof insight> => insight !== null)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MORNING_BRIEF_MAX_INSIGHTS);

  if (insights.length < MORNING_BRIEF_MIN_INSIGHTS) {
    return {
      generatedAt: new Date().toISOString(),
      insights,
      fallbackMessage:
        insights.length === 0 ? MORNING_BRIEF_FALLBACK_MESSAGE : null,
      hasEnoughData: true,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    insights,
    fallbackMessage: null,
    hasEnoughData: true,
  };
}

/** Default v0.1 provider — deterministic rules only */
export const rulesConciergeProvider: ConciergeProvider = {
  id: "rules",
  buildMorningBrief,
};

export function buildMorningBriefWithProvider(
  input: MorningBriefInput,
  provider: ConciergeProvider = rulesConciergeProvider,
): MorningBrief {
  return provider.buildMorningBrief(input);
}
