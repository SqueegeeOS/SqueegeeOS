export interface PhilosophyPrinciple {
  id: string;
  text: string;
}

/** Permanent company constitution — never edited in the UI. */
export const WHY_WE_EXIST: PhilosophyPrinciple[] = [
  {
    id: "consistent-care",
    text: "We believe every home deserves consistent care.",
  },
  {
    id: "craftsmanship",
    text: "We build trust through craftsmanship.",
  },
  {
    id: "systems",
    text: "We create systems that outlast us.",
  },
  {
    id: "family",
    text: "Every customer becomes part of the SqueegeeKing family.",
  },
];

/** Internal — why Headquarters exists. Not marketing copy. */
export const HEADQUARTERS_PURPOSE =
  "We built Headquarters to remember where we came from, understand where we are, and make wise decisions about where we're going.";
