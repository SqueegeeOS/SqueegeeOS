import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/home2/page";
import { Home2Homepage } from "@/components/marketing/home2-homepage";
import { isDisplayableReview } from "@/components/marketing/home2-reviews-wall";
import type { Review } from "@/lib/reviews/types";

describe("Home2Homepage", () => {
  it("keeps the preview route out of search indexing", () => {
    expect(metadata.title).toBe(
      "SqueegeeKing Membership — Home Care, Put on a Plan",
    );
    expect(metadata.description).toBe(
      "A recurring exterior home care membership built around your property, with care every 3 months or every 6 months as confirmed in your Home Care Plan.",
    );
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("keeps the public story membership-first and truth-qualified", () => {
    const html = renderToStaticMarkup(<Home2Homepage />);
    const membershipIndex = html.indexOf("Choose your care rhythm.");
    const serviceIndex = html.indexOf("Four forms of care.");
    const homeAtlasIndex = html.indexOf(
      "HomeAtlas supports the member experience behind the scenes.",
    );

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("flex flex-col lg:col-span-7 lg:min-h-[36rem]");
    expect(html).not.toContain(
      "flex flex-col justify-between lg:col-span-7",
    );
    expect(html).toContain("Home care,");
    expect(html).toContain("put on a plan.");
    expect(html).toContain("Assessment first. Home Care Plan second.");
    expect(html).toContain("Every 3");
    expect(html).toContain("Every 6");
    expect(
      html.match(/SqueegeeKing services, care rhythms, and location/g),
    ).toHaveLength(1);
    expect(html.match(/Window cleaning/g)).toHaveLength(2);
    expect(html.match(/Every 3 months/g)).toHaveLength(2);
    expect(html).toContain(
      "Your Home Care Plan presents the services, benefits, cadence, and visit price; your signed agreement confirms them.",
    );

    expect(membershipIndex).toBeGreaterThan(-1);
    expect(serviceIndex).toBeGreaterThan(membershipIndex);
    expect(homeAtlasIndex).toBeGreaterThan(serviceIndex);
  });

  it("does not reintroduce plan-dependent benefit claims", () => {
    const html = renderToStaticMarkup(<Home2Homepage />).toLowerCase();

    for (const unsupportedClaim of [
      "rainblock",
      "hard-water",
      "priority scheduling",
      "seven-day guarantee",
      "family rate, always",
      "calls answered first",
      "four exterior window cleaning visits per year",
      "two exterior window cleaning visits per year",
    ]) {
      expect(html).not.toContain(unsupportedClaim);
    }
  });

  it("preserves the existing four-star review selection policy", () => {
    const review: Review = {
      id: "verified-review",
      reviewerName: "Verified reviewer",
      rating: 4,
      reviewText: "Careful work.",
      reviewDate: "2026-07-19T00:00:00.000Z",
      source: "Google",
    };

    expect(isDisplayableReview(review)).toBe(true);
    expect(isDisplayableReview({ ...review, rating: 3 })).toBe(false);
    expect(isDisplayableReview({ ...review, rating: 5 })).toBe(true);
  });
});
