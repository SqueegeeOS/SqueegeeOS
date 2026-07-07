# HomeAtlas Architecture Guidelines

**Purpose:** How code is organized and how new work fits the system.  
**Companion:** [ARCHITECTURE.md](./ARCHITECTURE.md) — module map, routes, and implementation status tables.

---

## Repository Map

```
SqueegeeOS/                    # npm package name (unchanged)
├── app/                       # Next.js App Router — pages & API routes
├── components/                # React UI by domain
├── lib/                       # Business logic, no JSX
├── docs/                      # Permanent knowledge base (this folder)
├── reference/                 # External design philosophy notes
└── public/                    # Static assets
```

**Rule:** UI in `components/`, logic in `lib/`, routes in `app/`. API routes are thin — validate, call lib, return JSON.

---

## Domain Modules

| Domain | lib/ | components/ | Primary routes |
|--------|------|-------------|--------------|
| **Headquarters** | `lib/admin/` | `components/admin/` | `/hq` |
| **Concierge (Atlas)** | `lib/concierge/` | `components/admin/morning-brief.tsx` | `/hq` |
| **Home Care Plan** | `lib/home-care-plan/` | `components/home-care-plan/` | `/homecare/.../plan` |
| **Property** | `lib/property/` | `components/property/` | `/properties` |
| **Membership** | `lib/membership/` | `components/membership/` | `/portal/[token]`, presentation onboarding |
| **Reviews** | `lib/reviews/` | `components/reviews/` | `/api/reviews/google` |
| **Acquisition** | `lib/acquisition/` | `components/acquisition/` | `/request` |
| **Persistence** | `lib/persistence/` | — | `/api/persistence/*` |
| **Motion** | `lib/motion/` | `components/motion/` | all cinematic surfaces |
| **Brand** | `lib/brand/` | — | constants only |
| **Experience Lab** | `lib/experience/` | `components/experience/` | `/experience` |
| **Navigation** | `lib/navigation/` | `components/navigation/` | shared chrome |

Do not create cross-domain imports that skip the public API of a module — e.g. admin components should not import membership internals directly unless shared types demand it.

---

## App Router Conventions

### Pages

- **Server Components by default** — fetch on server where possible.
- **Client Components** (`"use client"`) for interactivity, motion, hooks, browser storage.
- Metadata via `export const metadata` or `platformPageTitle()` from brand lib.

### API Routes

Pattern:

```typescript
// app/api/admin/example/route.ts
export async function GET(request: Request) {
  // 1. authorize (PIN header, session, etc.)
  // 2. call lib function
  // 3. return NextResponse.json
}
```

Admin routes require `x-admin-pin` header — see `lib/admin/pin.ts`, `getAdminRequestHeaders()`.

### Route groups

| Prefix | Access |
|--------|--------|
| `/hq`, `/setup`, `/experience` | Admin PIN |
| `/employee` | Employee nav (future auth) |
| `/homecare/[slug]/...` | Customer experiences (demo slug routes) |
| `/portal/[token]` | Member portal (production customer access) |
| `/api/admin/*` | PIN + server secrets |

---

## Data Architecture

### Central entity: Property

```
Homeowner 1──* Property 1──* Visit (future)
                      ├── Timeline entries
                      ├── Photos
                      ├── Home Care Plan
                      ├── Membership
                      └── Documents
```

Property slug drives URLs: `/properties/[slug]`, `/homecare/[homeownerSlug]/[propertySlug]/plan`.

### Headquarters data

| Data | Storage | Sync |
|------|---------|------|
| Legacy baseline | Supabase `headquarters_profile` | `syncHeadquartersProfile()` |
| Closed jobs | Supabase + local merge | `/api/admin/overview` |
| Founder journal | Local / cloud (evolving) | session + migrate API |
| UI preferences | sessionStorage | client-only |

### Persistence adapter

```typescript
// lib/persistence/repository.ts — single entry point
// Adapters: sessionStorageAdapter (default), supabaseAdapter (implemented)
```

Never write `sessionStorage` in random components — go through persistence layer for plan data.

---

## Auth & Sessions

| Mechanism | Use |
|-----------|-----|
| `NEXT_PUBLIC_ADMIN_PIN` | Founder PIN for HQ, setup, experience lab |
| `sessionStorage` admin keys | Unlock TTL, PIN session for API calls |
| Google OAuth cookies | Business Profile setup wizard only |
| Supabase anon key | Client reads (when enabled) — RLS required |

**Never** expose admin PIN to client bundle logic beyond verification UI — PIN is checked server-side on API routes.

---

## Integrations

| Service | Client access | Server module |
|---------|---------------|---------------|
| Google Places | None | `lib/reviews/google-places.ts` |
| Google Business Profile | OAuth session | `lib/reviews/google-business-profile.ts` |
| Google OAuth | Redirect flow | `app/api/admin/google-reviews/oauth/*` |
| Supabase | Anon + service patterns | `lib/persistence/supabase/` |
| Stripe | None | `app/api/stripe/setup-intent`, `app/api/membership/setup-payment` |

Cache Google reviews 8 hours — `unstable_cache` on route.

---

## Component Patterns

### Admin surfaces

- `AdminSection` — eyebrow + title + cursor card wrapper
- `AdminStatCard` — metric with count-up
- `BootProvider` wraps HQ command center

### Customer surfaces

- `Reveal` in `components/marketing/ui.tsx` and property primitives — scroll-triggered (legacy); migrate to motion system over time
- Section-based plan layout in `components/home-care-plan/sections/`

### Shared

- Brand constants — never hardcode "SqueegeeKing" or "HomeAtlas" strings in JSX
- `ROUTES` from `lib/navigation/config.ts`

---

## Motion Integration

Wrap founder surfaces:

```tsx
<BootProvider>
  <AmbientFieldScoped>
    {/* BootLayer per section */}
  </AmbientFieldScoped>
</BootProvider>
```

Import springs from `@/lib/motion/system` — not duplicated easing arrays.

---

## Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_ADMIN_PIN` | Client + server | HQ gate |
| `NEXT_PUBLIC_SUPABASE_*` | Client | Persistence toggle |
| `GOOGLE_MAPS_API_KEY` | Server only | Places, reviews |
| `GOOGLE_PLACE_ID` | Server only | Production place |
| `GOOGLE_OAUTH_*` | Server only | Business Profile wizard |
| `SUPABASE_SERVICE_ROLE` | Server only | Migrations, admin writes |

Document new vars in ARCHITECTURE.md integration sections when added.

---

## Testing & Verification

| Command | Purpose |
|---------|---------|
| `npm run build` | Typecheck + production build — required before push |
| `npm run lint` | ESLint |
| `npm run verify:supabase` | Connection smoke test |

No exhaustive test suite yet — manual verification on `/hq`, flagship plan, and affected routes.

---

## Adding a New Feature — Checklist

1. Read [ENGINEERING_BIBLE.md](./ENGINEERING_BIBLE.md) and module map in [ARCHITECTURE.md](./ARCHITECTURE.md).
2. Identify domain folder in `lib/` and `components/`.
3. Add route in `app/` — server-first API if external service involved.
4. Use design tokens and motion primitives — [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [ANIMATIONS.md](./ANIMATIONS.md).
5. Update [ROADMAP.md](./ROADMAP.md) when shipped.
6. Update architecture status table in [ARCHITECTURE.md](./ARCHITECTURE.md) if module status changed.

---

## Technical Debt Register (Known)

| Item | Direction |
|------|-----------|
| Multiple `easeLuxury` copies in older components | Consolidate to `lib/motion/system.ts` |
| `Reveal` fade-up in marketing | Migrate to HeadlineReveal / BootLayer |
| Session-first persistence | Supabase default for plans + jobs + memberships |
| `/admin` vs `/hq` | **Headquarters** (`/hq`) is canonical per [BRAND.md](./BRAND.md) |

---

*Detailed route and file inventory: [ARCHITECTURE.md](./ARCHITECTURE.md).*
