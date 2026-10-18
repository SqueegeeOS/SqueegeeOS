# SqueegeeKing local presence and Marketing Desk

## Purpose and routes

Homeowners find the service they need, understand the quote, and request care. Founders turn confirmed job facts and permission-cleared media into drafts in Headquarters.

| Surface | Purpose |
|---|---|
| `/` | Service-first window cleaning and exterior home care in Chico, with quote and telephone actions |
| `/services/gutter-cleaning` | Property-specific gutter cleaning scope and buying questions |
| `/services/[slug]` | All five services have quote factors and links to homeowner guides |
| `/guides` and `/guides/[slug]` | Four practical guides on quotes, gutters, recurring care, and solar panels |
| `/hq/marketing` | Private job-to-content drafting workspace, 30-day calendar, and review readiness |
| `/api/admin/marketing` | Authenticated read-only context; returns only minimal completed-visit references, readiness, and the configured review destination |

## What the audit found

The baseline already had canonical URLs, a public-domain sitemap, robots rules, service structured data, and service pages for windows, pressure washing, solar, and memberships. The work preserves those foundations. It does not claim that a sitemap submission, rankings audit, Search Console inspection, or account-level Google profile update has happened.

The homepage led with the HomeAtlas concept before explaining the service. The revised first screen identifies window cleaning and Chico, explains other exterior services, and provides a direct free-quote and telephone path. HomeAtlas remains the membership differentiator below that message. Gutter cleaning was already offered by the request form but lacked a public service page. Service sharing metadata previously inherited the homepage's Twitter fields; each service now supplies its own.

No invented address, review count, testimonial, price, completed project, service-area office, or production-performance claim is added. The existing generated/illustrative site images are not evidence of a real completed job and must not be exported as before-and-after proof.

## Use the Marketing Desk

1. Sign in to Headquarters and open **Marketing**.
2. Review live review-request readiness and the links to Aftercare, Communications, and Google Reviews setup.
3. Use the Aftercare references to locate work in its source record. These references cover eligible review follow-ups, not the complete job history. They are not permission to publish.
4. Choose the service and enter a city/neighborhood and the work actually completed. Do not paste private customer notes, names, addresses, or contact information.
5. Confirm factual accuracy and permission for the media you intend to use.
6. Create the pack, then copy or download the social caption, Google post, filming script, project-story draft, neutral review-request draft, and AI editing brief.
7. Review and publish through the actual account. Nothing in the Desk posts or sends automatically.

Drafts are generated from editorial templates in the browser. There is no runtime LLM call, new AI subscription, external model data transfer, or automatic content publication. The optional AI editing brief can be used for a further writing pass. Drafts remain in the current page until copied or downloaded; they are not stored as customer business records. Editing facts invalidates the displayed pack so the owner must review again.

Common street addresses, email addresses, and telephone numbers are rejected in public summaries. This validation is not a complete personal-information classifier; owner review remains necessary. Source-record names, property labels, photos, private notes, and portal tokens are not included by the context endpoint.

## Review-request workflow

The repository already contains migration `087_completed_visit_review_requests.sql`, the rule `review_request_after_visit_sms`, and `processEligibleReviewRequests`, invoked by the existing Jobber reconciliation cron. The new Desk displays that existing processor's readiness; it does not create a competing sender.

The review destination resolves from the configured safe Google URL, the connected Google Business location, or the configured public Place ID. A missing link is shown honestly; the draft does not fabricate one. The existing sender checks contact verification, consent, timing, and idempotency. Review automation is not activated by this change, and no customer messages were sent as part of implementation.

After production deployment, inspect the live status. If the rule is off, use Communications only when you intend to enable customer messaging. A code build cannot establish that the production migration, provider approval, webhook verification, or account connection is complete.

## Content calendar and capture routine

`lib/marketing/content-calendar.ts` contains 30 ready-to-edit entries covering social captions, short-video scripts, Google posts, and stories. Start on any date; the day numbers are not scheduled dates. Each item specifies the real media needed. Download the full calendar from the Desk.

For a permission-cleared job, capture the same before/after view, a short process clip, and a factual voice note. Do not show house numbers, private schedules, faces, or account screens without separate permission. Use clearly labeled examples for the HomeAtlas demonstration.

## Attribution and measurement

Generated job-pack quote links go directly to `/request` with `utm_source`, `utm_medium`, and `utm_campaign`. The request form submits these labels, the server validates bounded text, and the saved lead notes include a clearly labeled visitor-supplied campaign note. Existing notes and intake idempotency remain intact. Invalid attribution never prevents an ordinary valid inquiry.

This is direct-link attribution only: it does not persist through unrelated navigation, cross-device visits, or later sessions. It does not infer traffic source, attribute telephone calls, verify platform claims, or add an analytics dashboard. The operator can review the note alongside the lead's existing contacted/quoted/booked stages. Use booked revenue and memberships as outcome measures; likes and views are supporting signals.

## Access needed outside the codebase

- Google Business Profile: owner access to update categories, services, hours, service area, photos, and posts. Do not publish a home address unless customers are served there.
- Search Console: verified property access to inspect indexing and submit the existing sitemap after deployment.
- Facebook/Instagram: publishing access and actual approved media.
- Live review automation: production readiness and an intentional activation through the existing rule controls.

These account changes, sitemap submission, social publication, and messaging activation have not been performed by this code change.

## Source guidance

- [Google local ranking guidance](https://support.google.com/business/answer/7091)
- [Google review-request guidance](https://support.google.com/business/answer/3474122)
- [Google generative-content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [Google Search AI features](https://developers.google.com/search/docs/appearance/ai-features)

The guides and drafts prioritize useful answers and actual service facts. They make no promise of a particular search ranking or inclusion in an AI answer.

## Verification record

- 67 focused tests pass across marketing, public metadata, request parameters, and mocked lead intake. The tests cover authorization before data reads, minimum-data responses, partial dependency failure, neutral review links, draft confirmation checks, common private-detail rejection, and campaign attribution without breaking existing notes or retry IDs.
- Production build and TypeScript pass. New marketing files pass targeted ESLint; the touched legacy founder navigation/overview retain five existing React-effect warnings and no lint errors.
- Local production HTTP checks return 200 for the homepage, services, gutter service, guide index, all four guides, sitemap, and robots file. Canonicals point to the public domain. The sitemap includes the new public pages and excludes the private Desk. The private context API returns 401 without authorization; the authenticated Desk renders with private/no-store and noindex protections.
- Broad-suite verification is incomplete: automatic approval review blocked continuation because it reported a Google Business Profile API call. It was not retried. External account state is not asserted.
- Browser visual and interaction verification is incomplete because the Chromium download failed in this environment. No screenshot-based layout claim is made. Tablet/mobile hero content uses normal flex flow so longer text can grow without covering the preview cards.
