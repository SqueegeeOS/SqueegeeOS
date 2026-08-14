import { describe, expect, it } from "vitest";
import {
  buildLocalBusinessJsonLd,
  buildServiceJsonLd,
  googleBusinessProfileUrl,
  serializeJsonLd,
} from "./local-seo";
import { PUBLIC_SERVICES } from "./public-services";

describe("local SEO contracts", () => {
  it("builds a Google Business Profile URL with the public Place ID", () => {
    const url = new URL(
      googleBusinessProfileUrl("ChIJQX_D76BQNSARonMZfaOHgKg"),
    );
    expect(url.searchParams.get("query_place_id")).toBe(
      "ChIJQX_D76BQNSARonMZfaOHgKg",
    );
  });

  it("gives every public service a unique indexable route", () => {
    const slugs = PUBLIC_SERVICES.map((service) => service.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("window-cleaning");
    expect(slugs).toContain("pressure-washing");
    expect(slugs).toContain("solar-panel-cleaning");
  });

  it("connects service structured data to SqueegeeKing", () => {
    const schema = buildServiceJsonLd(PUBLIC_SERVICES[0]);
    expect(JSON.stringify(schema)).toContain(
      "https://www.squeegeeking.net/#business",
    );
    expect(JSON.stringify(schema)).toContain("Chico");
  });

  it("uses the promoted homepage image in local business data", () => {
    const schema = buildLocalBusinessJsonLd();
    expect(JSON.stringify(schema)).toContain(
      "/atlas-glass/hero-house.jpg",
    );
  });

  it("escapes markup before embedding JSON-LD", () => {
    expect(serializeJsonLd({ value: "</script>" })).not.toContain("</script>");
  });
});
