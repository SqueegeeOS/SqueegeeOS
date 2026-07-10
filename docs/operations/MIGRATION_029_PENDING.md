# Migration 029 — intentionally pending in production

**Status:** Not applied to production as of post–migration-030 stabilization.  
**File:** `lib/persistence/supabase/migrations/029_portal_theme_preference.sql`

## What it changes

Adds `memberships.portal_theme` (`day` | `night` | `lux`, nullable) so a member’s HomeAtlas Atmosphere choice persists in the database across devices and browsers.

## Why the portal works without it

- **Default atmosphere:** `PORTAL_DEFAULT_ATLAS_THEME` (`lux`) applies when no saved preference exists (`lib/theme/atlas-themes.ts`).
- **Client fallback:** `localStorage` under `homeatlas-portal-theme:{membershipId}` holds the choice for return visits on the same browser (`lib/theme/portal-theme-persistence.ts`).
- **Graceful degradation:** `loadMembershipPortalRow` and `portal-theme.ts` detect a missing `portal_theme` column and continue without throwing.

Migration 029 is a **persistence enhancement**, not a blocker for schedule, billing, or membership reads.

## What will begin persisting after it is applied

- Member-selected Day / Night / Lux saved on the `memberships` row.
- Cross-device theme continuity (phone ↔ desktop) without relying on `localStorage`.
- `/api/portal/theme` writes will succeed against the column instead of no-op when the column is absent.

## Production QA required after apply

1. Run `029_portal_theme_preference.sql` in the Supabase SQL Editor.
2. Hit `GET /api/persistence/portal-integrity` — expect `checks.portal_theme.migration029Applied: true`.
3. Open Sylvia’s portal (`/portal/[token]`), switch atmosphere to **Day**, hard-refresh — theme should remain Day.
4. Open the same portal in a private/incognito window — theme should still be Day (DB-backed, not only localStorage).
5. Confirm schedule, add-ons, and savings sections unchanged (029 does not touch those tables).

## Do not apply until

- Migration 030 incident recovery is confirmed stable (service role on Vercel, portal schedule visible).
- A maintenance window is acceptable for a single `ALTER TABLE memberships` on production.
