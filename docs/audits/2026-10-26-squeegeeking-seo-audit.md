# SqueegeeKing: website SEO and consistency audit

**Checked:** October 26, 2026 (UTC)  
**Website:** https://www.squeegeeking.net/  
**Audit status:** Improvements implemented and checked locally. The user explicitly approved technician and SEO publication on October 26, 2026 after this audit was prepared. **Not live at this revision.** SEO deployment follows the technician release; preview checks and final live verification remain required. Findings below record the pre-release baseline, not the state of a completed deployment.

## Executive finding

The public site already has a useful local-service foundation: a clear Chico/window-cleaning homepage heading, five substantive service pages, working quote/contact paths, canonical domain redirects, a sitemap, and business/service structured data. The next gains should come from reliable discovery and conversion, consistent business facts, and measurement tied to booked recurring work - not more decorative pages or mass-produced city pages.

This audit found and fixed specific technical gaps in the local branch: duplicated homepage/services titles, inherited homepage social cards on other pages, missing legal-page canonicals, a blank initial quote-page response, missing main landmarks on quote/contact, and an indexable payment-return screen. These fixes reduce ambiguity and improve resilience; they do not guarantee higher rankings or revenue.

## Scope and evidence

- Inspected source route inventory: 95 page files, including private operational, transactional and design routes. Private customer/employee workflows were not crawled as SEO landing pages.
- Direct HTTP checks covered **23 URLs**, including **all 11 public pages discovered in public navigation**: homepage, services index, five service details, request, contact, privacy and terms.
- Also checked robots.txt, sitemap.xml, two nonexistent URLs, the /day2 redirect, five alternate homepage designs, the public sales-access screen and payment cancellation return.
- Cloud-browser checks confirmed live homepage headings, links, metadata and JSON-LD; service-page metadata and desktop rendering; quote-form field labels; reviews loading after navigation. No live quote was submitted and no customer record was created.
- Search-engine cached text showed an older homepage headline. Fresh live HTML and browser observations took precedence.
- Search Console, verified indexing reports, query rankings, backlink tools, GA4 reports, booked-lead attribution and field Core Web Vitals were not accessible/verified. This is not a ranking report or a claim that every device, interaction and private route was tested.

## Findings and changes

| Priority | Verified finding | Action / status |
|---|---|---|
| High | /request returned no H1 or meaningful form fallback in its initial HTML; the form appeared after JavaScript ran. | Added a server-rendered heading, concise quote/service explanation, direct phone link, loading status and no-JavaScript guidance. Form submission and pricing behavior are unchanged. Local build verified. |
| High | /payment/setup/cancelled returned index/follow and generic homepage metadata. | Added payment-segment noindex/nofollow metadata plus X-Robots-Tag and private/no-store headers for payment returns. No payment processing logic changed. Local generated HTML and header contract verified. |
| Medium | Homepage and /services had the same page title. | Services title now distinguishes the service directory: “Exterior Cleaning Services in Chico, CA”. |
| Medium | Non-home public pages inherited the homepage Twitter title/description/image; contact/request lost Open Graph image defaults because of metadata replacement. | Added one tested metadata builder for all 11 public routes: page-specific title, description, canonical, OG URL/site identity/image and Twitter card with image alt text. |
| Medium | /privacy and /terms had no canonical and inherited homepage OG URL. | Added self-canonicals and accurate policy-specific sharing metadata. Legal policy text is unchanged. |
| Medium | Quote and contact content lacked a main landmark. | Added semantic main elements without changing the layout or workflow. |
| Ongoing | Full Google review archive is unavailable; the supported Places preview works. | On the dated check, the public API reported five displayed reviews out of 133. Left dynamic source/attribution intact; did not create ratings, filter reviews, or hard-code counts. |
| Ongoing | Homepage share source image is about 3.3 MiB; browser hero uses Next optimized responsive output. | Record as an optimization opportunity, not proof of a slow site. No measured LCP/INP/CLS or Lighthouse score is available. |

### What already works

- All 11 public navigation routes returned HTTP 200. Two invented URLs returned HTTP 404, not soft-404 homepage substitutes.
- HTTPS apex redirects permanently (308) to the canonical www hostname. /day2 redirects to the homepage. Public page canonicals consistently use www.
- robots.txt and sitemap.xml return 200. The sitemap contains nine intended search landing pages: homepage, services index, five details, request and contact. Legal pages remain accessible through normal links; they need not be added merely to increase sitemap count.
- Service pages have distinct titles/descriptions, location-specific headings, useful scope/pricing-factor explanations, FAQs, phone/quote links, breadcrumbs, related-service links and Service/BreadcrumbList JSON-LD. No copied city doorway pages were added.
- Five inspected design variants already declare noindex. Their existence is not by itself an indexing failure.
- Homepage LocalBusiness/WebSite JSON-LD connects to the existing Google Place ID; service JSON-LD links to the same business identifier. No invented street address, hours, service area, price, review rating or insurance claim was added.
- Core marketing images have alt attributes and responsive image handling. Desktop screenshot inspection found legible service content. This is not a full accessibility compliance certification.

## Remaining work, in order

### 1. Publish and confirm the exact result

Repository/publication approval has been received. Reconcile onto the latest technician release without overwriting it; open a draft PR; run allowed checks on the final combined commit; deploy only with authorization. Then recheck live titles, canonicals, OG/Twitter cards, request fallback and payment noindex for that exact deployment. Ask Search Console to inspect key URLs and submit the existing sitemap once owner access is available. A published change is not proof of recrawling or indexing.

### 2. Resolve authoritative business facts before editing listings

Use a single approved business-facts record: public trading name, primary phone, canonical website, actual service coverage, accurate hours, eligible primary category and whether customers can visit a staffed storefront. Current site phone is **(530) 588-6235**. Keep SqueegeeKing as the home-service business and HomeAtlas as its member-care software; do not let the software brand replace the local-service identity.

Cross-network observations from the parallel audit:

- [Nextdoor](https://nextdoor.com/pages/the-squeegee-king-chico-ca/) matches the site phone, but displays “The Squeegee King”. Confirm real-world branding before renaming.
- [Birdeye](https://reviews.birdeye.com/squeegeeking-170154622549958) links to the correct site and displays a street address and Mon-Sat 8 a.m.-7 p.m./Sunday closed. This is third-party evidence, not owner confirmation of address or hours.
- An indexed probable match for the [Thumbtack SqueegeeKing/Noah Thomas profile](https://www.thumbtack.com/ca/chico/house-cleaning/squeegeeking/service/484684077450731527) showed 24-hour availability for at least Sunday/Monday and Commercial Cleaning. Direct access was anti-bot blocked, so these are indexed observations, not live account verification. Platform category taxonomies differ; the category is not automatically wrong. Confirm the actual offer and hours before editing or copying values into the site.
- Live Google Business Profile details, management access, account ownership and authoritative hours were not verified; Apple Maps and Yelp checks were robots-blocked. Bing, Facebook and Instagram had no independently verified match in this pass, which does not prove those profiles are absent. No listings were edited. Do not publish a residential address simply to satisfy structured-data fields. Google requires service-area businesses without an eligible customer-facing storefront to hide their address.

Add social/profile sameAs URLs only after identity and owner approval are established. A directory spelling difference is a consistency task, not proof it caused ranking loss.

### 3. Measure leads through recurring revenue

Set a baseline for the same 28-day period, compared with the previous period and the comparable season where history permits. Separate branded/nonbranded search and mobile/desktop. Track:

1. Search impressions, clicks, CTR and landing page/query visibility from Search Console.
2. Completed quote requests, not just CTA clicks. Fire GA4 generate_lead only after confirmed successful submission and avoid sending names, email, address or other personal data into analytics.
3. Click-to-call as a separate intent metric; it is not an answered call, qualified lead or booking. Google Business Profile performance can include ads, so do not equate all profile interactions with organic SEO.
4. Qualified inquiries -> quoted work -> booked jobs -> active recurring plans -> retained plans and recurring service value. Keep attribution, booked revenue and collected cash separate.
5. Source/medium/campaign on approved external links, with one naming convention. Do not put UTM tags on internal site links.

If the goal is $20,000 per month in recurring service value, required active plans = $20,000 divided by average monthly-equivalent value per active plan. For a quarterly-priced plan, divide its recurring quarterly amount by three; track cash timing separately. Actual plan economics and current baseline are required before forecasting.

No new analytics provider/account or conversion tracking was installed in this patch. Owner access and consent/privacy review are prerequisites to an analytics rollout.

### 4. Improve evidence and conversion, not just keywords

Build a small collection of owner-approved, permission-cleared local case studies showing the service, scope, problem solved and care rhythm. Do not publish customer photographs or addresses without permission. Use real service photographs rather than presenting illustrations as proof of a completed customer job. Keep one-time quote options obvious alongside membership value; measure whether the current membership-first form causes confusion before changing intake logic. Expand content using real customer questions and Search Console queries rather than assumed search volumes. Only add a new location page when there is genuine service coverage and useful distinct local information.

## Maintaining consistent results

- **After each website release:** verify the 11 public routes, page-specific metadata, sitemap/robots, real 404s, private noindex, call links and the quote flow in a test environment. Check the production commit/deployment matches the reviewed change.
- **Weekly:** review failed quote submissions, lead response times, new reviews and listing-change alerts. Invite genuine feedback without incentives or review gating; respond helpfully with customer privacy intact.
- **Monthly:** compare the 28-day acquisition-to-booking funnel by channel, service and landing page; inspect indexing exclusions and Core Web Vitals; confirm name/phone/URL/hours/category/service-area consistency across Google, Bing, Apple, Nextdoor, Yelp, Thumbtack and relevant social profiles that are actually owned.
- **Quarterly:** review recurring-plan retention, capacity, route density and margin; refresh inaccurate content and approved images; improve underperforming pages based on evidence. Keep a change log so attribution does not become guesswork.

This is a recommended operating cadence, not a schedule or automation that has been created. Neither uniform rankings nor identical results across networks can be guaranteed: their audiences, algorithms, proximity and intent differ.

## Validation and limitations

**Passed locally:** production build via Next 16.2.10 webpack; TypeScript after build-generated declarations; ESLint on changed files; git diff whitespace check; focused 5 files / 31 pure SEO/navigation/form contract tests. Inspected production-generated HTML for ten static public pages plus payment cancellation: matching search/OG/Twitter titles, one public canonical and H1, request phone fallback, payment noindex. Contact remains dynamic and has source/type coverage, not local runtime QA.

A prior full-suite run completed 347 files / 1,648 tests successfully before the parent reported an auto-review concern about external Google API tests in a separate checkout. It was not rerun after that warning. Inspected Google review tests use fetch/provider mocks or pure file/config/crypto checks; the run logs do not independently prove zero network activity across the whole suite.

**Not passed/not available:** mobile device simulation and full accessibility audit; local runtime browser flow after the patch; real lead submission, payment flow or authenticated customer testing; Search Console indexing/rankings; GA4 attribution; field Core Web Vitals. Headless Chromium was blocked by sandbox socket restrictions; an escalation failed before launch because the environment could not create its sessions mount. Browser DevTools were organization-blocked. Local Next start hit a network-interface sandbox error. PageSpeed Insights returned HTTP 429 quota exhaustion. These are validation limits, not measured website failures. No restriction was bypassed and no further retry was made against the denied session path.

**Publication history:** no remote push, PR, merge, listing edit or deployment had occurred at the original audit handoff. The user subsequently approved publication of both the technician and SEO patches to the exact repository. That new authorization does not itself prove a successful release; check the deployment and live verification before marking the work live. No listing edits or customer-photo publication are included.

## Primary guidance

- [Google: descriptive title links](https://developers.google.com/search/docs/appearance/title-link) - unique, informative page titles; search appearance is ultimately selected by Google.
- [Google: canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) - consistent canonical signals and redirects.
- [Google: robots.txt limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro) - robots controls crawling, not access security or guaranteed deindexing.
- [Google: sitemap best practices](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) - canonical URLs and truthful modification dates; priority/changefreq are not ranking boosts.
- [Google: JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) - content must be crawlable and renderable.
- [Google: LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business) - accurate business information; no promise of a rich result. A missing eligible public address is not a reason to fabricate one.
- [Google: local ranking](https://support.google.com/business/answer/7091?hl=en) - relevance, distance and prominence matter; accurate, complete profiles and genuine feedback help.
- [Google: Business Profile performance definitions](https://support.google.com/business/answer/9918094) - distinguish interactions and call-button clicks from completed leads.
- [Google: business representation guidelines](https://support.google.com/business/answer/3038177?hl=en) - real-world naming, categories and service-area address eligibility.
- [Google: page experience](https://developers.google.com/search/docs/appearance/page-experience) - mobile usability, secure delivery and overall experience; no single score guarantees ranking.
- [GA4: recommended events](https://support.google.com/analytics/answer/9267735?hl=en) and [campaign URL tagging](https://support.google.com/analytics/answer/10917952?hl=en) - consistent lead and acquisition measurement.
