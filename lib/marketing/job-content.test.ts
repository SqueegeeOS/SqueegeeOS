import { describe, expect, it } from "vitest";
import { buildJobContentPack, campaignQuoteUrl } from "./job-content";

const input = { serviceSlug: "window-cleaning", area: "Chico", workPerformed: "Cleaned exterior glass and the screens included in the approved scope.", factsConfirmed: true, mediaApproved: true };

describe("job marketing drafts", () => {
  it("uses confirmed facts in the public captions and preserves a campaign quote link", () => {
    const drafts = buildJobContentPack(input);
    const social = drafts.find((draft) => draft.id === "social")!.text;
    expect(social).toContain(input.workPerformed);
    expect(social).toContain("Window Cleaning in Chico");
    expect(social).toContain("utm_source=facebook_instagram");
    expect(social).not.toContain("five-star");
  });
  it.each([{ factsConfirmed: false }, { mediaApproved: false }])("requires evidence and media checks: %o", (change) => {
    expect(() => buildJobContentPack({ ...input, ...change })).toThrow();
  });
  it.each(["", "unknown-service"])("rejects unsupported service %s", (serviceSlug) => {
    expect(() => buildJobContentPack({ ...input, serviceSlug })).toThrow();
  });
  it.each(["123 Main Street", "person@example.com", "Chico\nPrivate address"])("rejects private details in the area: %s", (area) => {
    expect(() => buildJobContentPack({ ...input, area })).toThrow();
  });
  it.each(["Cleaned the windows at 123 Main Street today.", "Cleaned glass; contact person@example.com for details.", "Cleaned exterior glass. Call 530-555-0100 for photos."])("rejects common contact details in the public summary", (workPerformed) => {
    expect(() => buildJobContentPack({ ...input, workPerformed })).toThrow();
  });
  it("never creates an invented review destination", () => {
    const draft = buildJobContentPack({ ...input, reviewUrl: "https://example.com/fake-review" }).find((item) => item.id === "review")!;
    expect(draft.text).toContain("Add your verified Google review link");
    expect(draft.text).not.toContain("https://example.com");
  });
  it("uses a configured Google destination in a neutral review request", () => {
    const reviewUrl = "https://g.page/r/example/review";
    const draft = buildJobContentPack({ ...input, reviewUrl }).find((item) => item.id === "review")!;
    expect(draft.text).toContain(reviewUrl);
    expect(draft.text).toContain("honest Google review");
    expect(draft.text).not.toContain("five-star");
  });
  it("encodes campaign labels while keeping the destination on the quote page", () => {
    const url = new URL(campaignQuoteUrl("google_business_profile", "job_window-cleaning"));
    expect(url.origin).toBe("https://www.squeegeeking.net");
    expect(url.pathname).toBe("/request");
    expect(url.searchParams.get("utm_campaign")).toBe("job_window-cleaning");
    expect(url.searchParams.get("utm_medium")).toBe("organic");
  });
});
