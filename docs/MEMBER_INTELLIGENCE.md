# HomeAtlas Member Intelligence System

Three systems, one customer record. Every interaction feeds the brain; every output makes the next interaction more personal.

## Systems

| System | Purpose | Primary tables |
|--------|---------|----------------|
| **Member Profile Engine** | Who they are, savings, appointments | `member_profiles`, `member_savings_transactions`, `member_appointments` |
| **Property Intelligence** | Home facts, photos, access notes | `properties` (+ JSONB), `property_assets` |
| **AI Quote Engine** | Field input → personalized proposal | `service_observations`, `ai_quotes` |

All three anchor on **`homeowners`** → **`properties`**. Membership billing stays in existing `memberships`.

## Schema

**Canonical reference:** `lib/persistence/supabase/schema.sql`  
**Migration:** `lib/persistence/supabase/migrations/005_member_intelligence.sql`

Run in Supabase SQL editor (or via `SUPABASE_DB_URL`):

```bash
# After setting SUPABASE_DB_URL in .env.local
psql "$SUPABASE_DB_URL" -f lib/persistence/supabase/migrations/005_member_intelligence.sql
```

### New / extended tables

```
homeowners (existing)
properties (extended: zillow_url, property_details, service_notes, …)
property_assets (extended: photo_source, is_primary, external_url)
member_profiles
member_savings_transactions
member_appointments
service_observations
ai_quotes
```

### TypeScript

| Layer | Path |
|-------|------|
| Persistence rows | `lib/persistence/types/member-profile.ts`, `property-intelligence.ts`, `ai-quote.ts` |
| Domain / portal views | `lib/member-intelligence/types.ts` |
| Photo priority | `lib/member-intelligence/photo-priority.ts` |
| AI prompt builder | `lib/member-intelligence/quote-prompt.ts` |

## Build sequence

```
Phase 1 (Week 1–2) — Foundation
├── Run migration 005
├── Run seed: lib/persistence/supabase/seeds/001_canyon_oaks_demo.sql
├── Wire saveMembership() after payment setup (`setup-payment`)
├── Portal reads member_profiles + appointments via token route `/portal/[token]`
└── Enable NEXT_PUBLIC_SUPABASE_ENABLED=true + PERSISTENCE_BACKEND=supabase

Phase 2 (Week 3–4) — Property Intelligence
├── Zillow URL → Open Graph photo pull (Option C MVP)
├── Photo upload + set primary (our_team)
└── Property details admin form

Phase 3 (Week 5–6) — AI Quote Engine
├── Mobile field input screen (/employee/quote or similar)
├── POST /api/quotes/generate (OpenAI + buildAIQuotePrompt)
└── Quote preview + email/SMS delivery

Phase 4 (Week 7–8) — Intelligence layer
├── Auto-calculate savings from completed appointments
├── “Your home is due for X” nudges
└── Member dashboard fully live
```

## Environment

```env
NEXT_PUBLIC_SUPABASE_ENABLED=true
NEXT_PUBLIC_PERSISTENCE_BACKEND=supabase
OPENAI_API_KEY=sk-...          # server-only, Phase 3
OPENAI_QUOTE_MODEL=gpt-4o      # optional
```

## Zillow photos (MVP path)

**Option C (recommended first):** Staff pastes Zillow URL → server fetches Open Graph image → store in `property_assets` with `photo_source = 'zillow'` and `external_url`.

Bridge API / RapidAPI can replace this in Phase 2.

## AI quote flow

1. Tech completes `FieldInputs` on site (condition, flags, vibe, notes).
2. Row saved to `service_observations`.
3. `buildAIQuotePrompt()` merges property details + member context.
4. OpenAI returns prose → `ai_quotes.generated_text`.
5. Show on tablet / email to homeowner.

Prompt version tracked in `ai_quotes.prompt_version` (`v1` in code).

## Auth note

RLS policies are permissive (`using (true)`) until Supabase Auth ships. Tighten to `auth.uid()` ↔ `homeowners.auth_user_id` before production member data.

## Wiring checklist (existing gaps)

- [ ] `saveMembership()` called after Stripe checkout
- [x] Portal reads `memberships` + `member_profiles` (when Supabase enabled)
- [ ] `visit_id` on photos links to `member_appointments`
- [ ] Enable cloud persistence in production env
