# Atlas — AI Concierge Architecture

**Codename:** Atlas  
**User-facing name (today):** HomeAtlas Morning Brief  
**Module:** `lib/concierge/`  
**First surface:** Headquarters (`/hq`)

---

## What Atlas Is

Atlas is the long-term **operating intelligence** of HomeAtlas — not a chatbot mascot, not a generic "AI assistant" badge.

Atlas observes company state (revenue, reviews, membership, missions, operational context) and surfaces **what matters today** in language a founder can act on. It starts deterministic and rule-based. It evolves toward contextual copilot and proactive operations — always PIN-gated, always grounded in real data.

Atlas never fabricates metrics. When data is insufficient, it says so plainly.

---

## Philosophy

| Principle | Implementation |
|-----------|----------------|
| **Useful before conversational** | Morning Brief cards, not open-ended chat (v0.1) |
| **Grounded in truth** | Inputs from dashboard, closed jobs, live reviews snapshot |
| **Calm tone** | No exclamation marks, no "AI-powered magic" |
| **Invisible when empty** | Fallback message instead of filler insights |
| **Extensible provider** | `ConciergeProvider` interface — rules today, LLM tomorrow |

---

## Current Architecture (v0.1)

```
MorningBriefInput
├── operatingContext   (jobs, members, plans, legacy baseline)
├── dashboard          (executive stats, membership, sources)
├── googleReviews      (connected, count, rating)
└── missions           (computed current missions)

        ↓
  buildMorningBrief()
        ↓
  CONCIERGE_RULES[]    (priority-sorted insights)
        ↓
MorningBrief
├── insights[]         (max 5, min 3 when possible)
├── fallbackMessage
└── hasEnoughData
```

### Key files

| File | Role |
|------|------|
| `lib/concierge/types.ts` | Contracts, provider interface |
| `lib/concierge/rules.ts` | Individual insight rules + data thresholds |
| `lib/concierge/build-morning-brief.ts` | Orchestration |
| `components/admin/morning-brief.tsx` | Presentation + typewriter motion |

### Insight categories

`revenue` · `arr` · `reputation` · `operations` · `membership` · `platform`

Each insight: `id`, `category`, `title`, `body`, `priority`.

Rules return `null` when not applicable — no spam.

---

## Data Thresholds

`hasEnoughConciergeData()` gates the brief. Without sufficient closed jobs / membership / review signal, Atlas shows:

> *Log more jobs and memberships to unlock smarter recommendations.*

This is intentional — **false intelligence erodes trust faster than silence.**

---

## Presentation

Morning Brief renders as a **HomeAtlas-branded section** at top of Headquarters:

- Eyebrow: `HomeAtlas`
- Title: `HomeAtlas Morning Brief`
- Subtitle references codename internally: *What Atlas noticed for today.*
- Insight cards type themselves in (`TypewriterText`) during HQ boot sequence

Atlas does not use an avatar. The brand mark is typography and restraint.

---

## Evolution Roadmap

### Phase 1 — Rules (now)

Deterministic insights from structured inputs. Fully testable. No API cost. Ships trust.

### Phase 2 — Enriched rules + scoring

- Weighted priority by founder goals (freedom meter linkage)
- Seasonal operations hints
- Review velocity and rating trend rules
- Membership churn heuristics

### Phase 3 — LLM provider (`ConciergeProvider.id: "openai"`)

Same input/output contract. LLM generates prose from **structured facts only** — JSON context injected, numbers cited from input object, hallucination guards:

- Must not invent revenue figures
- Must cite insight category
- Fallback to rules provider on failure

### Phase 4 — Operator copilot

PIN-gated conversational panel in Headquarters:

- "Why did ARR drop this month?"
- "Draft follow-up for Larry's plan"
- "Summarize last week's closed jobs"

Still server-side. Still logged.

### Phase 5 — Field intelligence

Post-visit automation (Technician App integration):

- Professional visit notes from technician bullets + photos
- Customer-visible summary generation
- Home Care Score update explanations
- Follow-up email/SMS drafts for founder approval

This is the **AI Engine** in ARCHITECTURE.md — Atlas becomes the orchestration layer name.

---

## What Atlas Is Not (v1–v2)

- Customer-facing chat widget on marketing site
- Autonomous agent sending emails without approval
- Replacement for founder judgment on pricing or hiring
- Voice assistant / phone bot

---

## Provider Interface

```typescript
interface ConciergeProvider {
  id: "rules" | "openai";
  buildMorningBrief(input: MorningBriefInput): MorningBrief;
}
```

Future providers may add:

```typescript
interface ConciergeProvider {
  buildMorningBrief(input: MorningBriefInput): MorningBrief;
  answerOperatorQuery?(input: OperatorQueryInput): OperatorQueryResponse;
  summarizeVisit?(input: VisitSummaryInput): VisitSummary;
}
```

Extend interfaces in `types.ts` — do not fork ad-hoc AI calls across components.

---

## Security & Privacy

- All Atlas API routes admin-authenticated
- No homeowner PII sent to LLM without explicit policy review
- Log prompts and outputs for founder audit (future)
- Google Reviews and revenue data stay server-side — client receives rendered brief only

---

## Success Metrics

| Metric | Signal |
|--------|--------|
| Founder opens HQ daily | Brief is worth the unlock |
| Insight action rate | Founders act on at least one card / week |
| Zero fabricated metrics | No support tickets about wrong numbers |
| Time to brief | < 200ms rules path |

---

## Copy Guidelines for Atlas-Generated Text

- Short sentences. One idea per card body.
- Prefer "This month" / "Since OS launch" time anchors.
- Reference real thresholds (*"Three pending requests awaiting follow-up"*).
- Never: *"Great job!"* / *"You're crushing it!"* / emoji.

---

## Related Docs

- [BRAND.md](./BRAND.md) — Atlas vs HomeAtlas naming
- [ROADMAP.md](./ROADMAP.md) — V1.1 brief enrichment, V2 copilot
- [ARCHITECTURE.md](./ARCHITECTURE.md) — AI Engine module map

---

*Atlas earns its name when founders miss it on days it fails to load — not when we put "AI" on a landing page hero.*
