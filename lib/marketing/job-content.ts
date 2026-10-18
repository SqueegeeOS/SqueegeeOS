import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
import { getPublicService } from "./public-services";
import { isSafeGoogleReviewRequestUrl } from "@/lib/reviews/review-request-url";

export interface JobContentInput {
  serviceSlug: string;
  area: string;
  workPerformed: string;
  factsConfirmed: boolean;
  mediaApproved: boolean;
  reviewUrl?: string | null;
}

export interface MarketingDraft {
  id: string;
  title: string;
  text: string;
}

export function campaignQuoteUrl(source: string, campaign: string): string {
  const url = new URL("/request", PUBLIC_SITE_URL);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", source === "google_business_profile" ? "organic" : "social");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

/** Editorial automation, not an LLM call. Never sends, publishes, or imports private property data. */
export function buildJobContentPack(input: JobContentInput): MarketingDraft[] {
  const service = getPublicService(input.serviceSlug);
  if (!service) throw new Error("Choose a service from the list.");
  if (!input.factsConfirmed) throw new Error("Confirm the completed work before creating a job story.");
  if (!input.mediaApproved) throw new Error("Confirm permission for the media you plan to publish.");
  const area = input.area.trim().replace(/\s+/g, " ");
  const work = input.workPerformed.trim();
  if (area.length < 2 || area.length > 80 || /[\d@<>\r\n]/.test(input.area)) throw new Error("Use a city or neighborhood, without a street address.");
  if (work.length < 20 || work.length > 900) throw new Error("Describe the confirmed work in 20–900 characters.");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(work) || /\b\d{1,6}\s+(?:[A-Za-z]+\s+){0,4}(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|way|boulevard|blvd)\b/i.test(work) || /(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/.test(work)) {
    throw new Error("Remove street addresses, email addresses, and phone numbers from the public work summary.");
  }
  const campaign = `job_${service.slug}`;
  const socialUrl = campaignQuoteUrl("facebook_instagram", campaign);
  const googleUrl = campaignQuoteUrl("google_business_profile", campaign);
  const reviewUrl = input.reviewUrl && isSafeGoogleReviewRequestUrl(input.reviewUrl) ? input.reviewUrl.trim() : null;
  return [
    { id: "social", title: "Facebook / Instagram caption", text: `${service.name} in ${area}.\n\n${work}\n\nHave a similar project? Request a property-specific quote from SqueegeeKing: ${socialUrl}` },
    { id: "google", title: "Google Business Profile post", text: `${service.name} in ${area}\n\n${work}\n\nSqueegeeKing provides window cleaning and exterior home care. Tell us about your property for a clear quote.\n\nButton link: ${googleUrl}` },
    { id: "video", title: "Reel / Short filming script", text: `0–3 seconds: show the approved before view. On-screen title: ${service.name} · ${area}.\n3–15 seconds: show the work actually performed. Voiceover: ${work}\n15–25 seconds: show the matching after view. Keep the lighting and angle comparable.\nClosing: “Ask SqueegeeKing for a quote for your home.”\nUse only footage covered by the homeowner's permission.` },
    { id: "project", title: "Website project story draft", text: `# ${service.name} in ${area}\n\n## Work completed\n${work}\n\n## Photos\nAttach only approved, relevant before-and-after images. Remove names, house numbers, faces, and private details unless separately authorized.\n\n## Planning similar care?\nReview our ${service.navLabel} service: ${PUBLIC_SITE_URL}/services/${service.slug}\nRequest a quote: ${socialUrl}\n\nEditorial draft: verify the scope and select the actual images before publishing.` },
    { id: "review", title: "Neutral review-request draft", text: reviewUrl ? `Thank you for choosing SqueegeeKing. If you would like to share your experience, you can leave an honest Google review here: ${reviewUrl}\n\nWe appreciate your feedback.` : "Thank you for choosing SqueegeeKing. We appreciate your feedback.\n\nAdd your verified Google review link before sending a review request. Configure it in Google Reviews setup; no destination has been invented." },
    { id: "brief", title: "AI editing brief", text: `Edit the following approved SqueegeeKing job summary into a concise social caption. Use only these facts. Do not invent testimonials, prices, dates, location details, savings, or service results. Do not include customer names or street addresses. Keep the quote link unchanged. Return a draft for owner review.\n\nService: ${service.name}\nArea: ${area}\nConfirmed work: ${work}\nQuote link: ${socialUrl}` },
  ];
}

export function exportJobContentPack(drafts: MarketingDraft[]): string {
  return ["# SqueegeeKing — job marketing drafts", "Owner review required. Nothing has been published or sent.", ...drafts.map((draft) => `## ${draft.title}\n\n${draft.text}`)].join("\n\n");
}
