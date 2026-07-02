#!/usr/bin/env node
/**
 * End-to-end cloud persistence smoke test (Supabase adapter path).
 * Usage: npm run test:cloud-persistence
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

const homeownerSlug = "cloud-persistence-test";
const propertySlug = "test-residence";
const presentation = {
  homeowner: {
    firstName: "Test",
    fullName: "Cloud Persistence Test",
    slug: homeownerSlug,
  },
  property: {
    name: "Test Residence",
    slug: propertySlug,
    address: "1 Test Lane",
    city: "Chico",
    state: "California",
    heroImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200",
    yearBuilt: 2020,
    homeCareScore: 88,
    lastVisit: "July 2, 2026",
    membershipRecommendation: "Preferred Care",
  },
  brand: {
    company: "Squeegeeking",
    tagline: "Premium Home Care.",
    craftedFor: "Crafted for Cloud Persistence Test",
    footerLines: ["Test run"],
  },
  hero: {
    title: "Cloud Persistence Test Plan",
    subheadline: "Smoke test",
    intro: "Verifying Supabase save and load.",
    cta: "Begin",
  },
  propertyHealth: { rating: "Excellent", narrative: "Test narrative." },
  propertyProfile: [],
  findings: [],
  recommendation: { headline: "Test", paragraphs: ["Test"], closing: "Test" },
  personalNote: {
    greeting: "Test,",
    paragraphs: ["Cloud persistence check."],
    signoff: "Noah",
    title: "Founder",
    company: "Squeegeeking",
  },
  memberships: [],
  careJourney: [],
  membershipBenefits: [],
  team: [],
  reviews: { totalCount: 0, averageRating: 5, source: "Google", reviews: [] },
  closing: {
    headline: "Test",
    subline: "Test",
    phone: "(530) 588-6235",
    location: "Chico, California",
    cta: "Become a Member",
  },
};

console.log("Cloud persistence smoke test…\n");

const { data: homeowner, error: hoError } = await supabase
  .from("homeowners")
  .upsert(
    {
      slug: homeownerSlug,
      full_name: presentation.homeowner.fullName,
      first_name: presentation.homeowner.firstName,
      email: "test@example.com",
      phone: null,
    },
    { onConflict: "slug" },
  )
  .select("*")
  .single();

if (hoError) {
  console.error("Homeowner upsert failed:", hoError.message);
  process.exit(1);
}
console.log("✓ Homeowner upserted:", homeowner.id);

const { data: property, error: propError } = await supabase
  .from("properties")
  .upsert(
    {
      homeowner_id: homeowner.id,
      slug: propertySlug,
      name: presentation.property.name,
      address: presentation.property.address,
      city: presentation.property.city,
      state: presentation.property.state,
      zip: "95928",
      type: "Residence",
      hero_image: presentation.property.heroImage,
      home_care_score: presentation.property.homeCareScore,
      last_visit: presentation.property.lastVisit,
    },
    { onConflict: "homeowner_id,slug" },
  )
  .select("*")
  .single();

if (propError) {
  console.error("Property upsert failed:", propError.message);
  process.exit(1);
}
console.log("✓ Property upserted:", property.id);

const now = new Date().toISOString();
const { data: plan, error: planError } = await supabase
  .from("home_care_plans")
  .upsert(
    {
      homeowner_id: homeowner.id,
      property_id: property.id,
      homeowner_slug: homeownerSlug,
      property_slug: propertySlug,
      status: "generated",
      presentation,
      draft: null,
      storage_backend: "supabase",
      generated_at: now,
      updated_at: now,
    },
    { onConflict: "homeowner_slug,property_slug" },
  )
  .select("*")
  .single();

if (planError) {
  console.error("Home care plan upsert failed:", planError.message);
  process.exit(1);
}
console.log("✓ Home care plan saved:", plan.id);

const { data: loaded, error: loadError } = await supabase
  .from("home_care_plans")
  .select("*")
  .eq("homeowner_slug", homeownerSlug)
  .eq("property_slug", propertySlug)
  .single();

if (loadError) {
  console.error("Load failed:", loadError.message);
  process.exit(1);
}

const title = loaded.presentation?.hero?.title;
if (title !== "Cloud Persistence Test Plan") {
  console.error("Round-trip mismatch:", title);
  process.exit(1);
}

console.log("✓ Round-trip load OK:", title);
console.log("\nCloud persistence is working.");
console.log(
  `  Presentation URL: /homecare/${homeownerSlug}/${propertySlug}/plan`,
);
