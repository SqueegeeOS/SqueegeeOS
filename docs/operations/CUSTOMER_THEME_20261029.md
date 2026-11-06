# Cohesive homeowner theme — 2026-10-29

## Direction
Preserve SqueegeeKing's editorial forest-green, warm-ivory and champagne identity. Reuse the existing Cormorant/Geist fonts and Atlas mark; no new font, design dependency, image, or invented customer proof.

- Public quote, contact, service and policy pages share `.customer-theme`, semantic colors and consistent buttons. Legal text is unchanged.
- The quote continues to accept the same payload with the same validation, consent, idempotency and membership options. Copy explicitly welcomes one-time inquiries; optional membership can remain unselected.
- Homepage/tablet content stays in normal flow below 1100px. Mobile navigation provides direct services, quote, contact and member-entry links. The decorative orbit becomes readable benefit chips, and preview controls form a two-column grid.
- Homepage no longer advertises a Reviews anchor that can be empty when its provider is unavailable. Existing real-review rendering and attribution are unchanged.
- Member Day/Night/Lux identifiers, default and persistence are preserved. They now share a forest/ivory/champagne family. Theme scopes do not change Headquarters or technician root colors.
- Portal task shortcuts fit two columns on phones. Appearance is an explicit, keyboard-accessible disclosure after the care content, with native radios and save/retry status.
- The portal entry retains its existing stored-token redirect, with a branded help/home/call fallback. No new authentication mechanism or public customer record is introduced.
- Existing Home Care Plan content adopts the shared Night palette; checkout/unlock providers and terms are unchanged.

## Boundaries
No changes to APIs, database, login or access checks, membership economics, prices, service operations, stored customer data, review source/rating filters, or payment processing. No merge or production release is authorized by this patch.

## Validation
- Passed: production Next.js 16.2.10 webpack build and generated TypeScript checks.
- Passed: 12 focused pure/mocked test files / 68 tests covering theme, portal interaction/persistence, homepage, public metadata, quote compliance and portal view models.
- Passed: local production HTTP checks for `/`, `/request`, `/services`, `/services/window-cleaning`, `/contact`, `/privacy`, `/terms` and `/portal` (200, expected server-rendered content, one main landmark each).
- Changed-file ESLint and whitespace checks. Existing effect/ref warnings in portal entry, theme provider, mobile drawer and quote transition are not new failures.
- Native theme tests cover dirty preview, explicit save, failure/retry, repeated save, local preference and token redirect behavior. No live member request is submitted by tests.

## Remaining visual gate
The cloud browser could not connect to the local executor's loopback server (`ERR_CONNECTION_REFUSED`). This is an environment access limit, not evidence of an app failure. Desktop/mobile screenshots of this patch and authenticated member-screen visual QA are not claimed. Review an authorized preview at 390px, 900px and desktop widths, including request → success, mobile drawer close/back, and Day/Night/Lux before production promotion. Do not weaken deployment or application protection to obtain screenshots.

## Publication authority
The initial commit/push attempt was blocked before execution because the request only authorized implementation. On 2026-10-29 at 00:37 UTC the user explicitly approved pushing the changes to GitHub and opening a draft PR, including automatic checks and a preview build. This authorizes preview review, not a merge or production deployment. Check the actual PR and exact-commit checks for publication status.
