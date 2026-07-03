export const GOOGLE_REVIEWS_WIZARD_KEY = "squeegeeking:google-reviews-wizard";

export interface GoogleReviewsWizardState {
  apiKey: string;
  placeId: string;
  businessName: string;
  mapsUrl: string;
  searchQuery: string;
  testPassed: boolean;
  lastRating: number | null;
  lastReviewCount: number | null;
}

export const DEFAULT_WIZARD_STATE: GoogleReviewsWizardState = {
  apiKey: "",
  placeId: "",
  businessName: "",
  mapsUrl: "",
  searchQuery: "SqueegeeKing Chico, CA",
  testPassed: false,
  lastRating: null,
  lastReviewCount: null,
};

export const GOOGLE_CONSOLE_LINKS = {
  createProject: "https://console.cloud.google.com/projectcreate",
  placesApiNew:
    "https://console.cloud.google.com/marketplace/product/google/places-backend.googleapis.com",
  placesApiLegacy:
    "https://console.cloud.google.com/marketplace/product/google/places.googleapis.com",
  credentials: "https://console.cloud.google.com/apis/credentials",
  billing: "https://console.cloud.google.com/billing",
} as const;

export const WIZARD_STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "project", title: "Google Cloud project" },
  { id: "apis", title: "Enable APIs" },
  { id: "api-key", title: "Create API key" },
  { id: "restrict", title: "Restrict key" },
  { id: "find", title: "Find your business" },
  { id: "test", title: "Test connection" },
  { id: "deploy", title: "Save & deploy" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export function loadWizardState(): GoogleReviewsWizardState {
  if (typeof window === "undefined") return DEFAULT_WIZARD_STATE;
  const raw = localStorage.getItem(GOOGLE_REVIEWS_WIZARD_KEY);
  if (!raw) return DEFAULT_WIZARD_STATE;
  try {
    return { ...DEFAULT_WIZARD_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WIZARD_STATE;
  }
}

export function saveWizardState(state: GoogleReviewsWizardState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GOOGLE_REVIEWS_WIZARD_KEY, JSON.stringify(state));
}

export function buildEnvLocalSnippet(apiKey: string, placeId: string): string {
  return `# Google Reviews (server-only)
GOOGLE_MAPS_API_KEY=${apiKey}
GOOGLE_PLACE_ID=${placeId}
`;
}

export function buildVercelInstructions(apiKey: string, placeId: string): string {
  return `Add these in Vercel → Project → Settings → Environment Variables (Production + Preview):

GOOGLE_MAPS_API_KEY
${apiKey}

GOOGLE_PLACE_ID
${placeId}

Then redeploy the project.`;
}
