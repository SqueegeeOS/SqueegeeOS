# SYSTEM — Loop Engineering Briefing (read first, every cycle)

## Project
SqueegeeOS / HomeAtlas: production Next.js (custom 16.2.10 — read
node_modules/next/dist/docs before framework changes) + Supabase + Stripe +
Vercel. Real paying members. AGENTS.md at repo root is LAW and overrides
this file on any conflict.

## Owner preferences (learned, binding)
- Small reversible slices; one concern per commit; never one giant branch.
- Gates before merge: `npx tsc --noEmit` clean (3 legacy test-fixture errors
  known), `npm test` green, migration audit if schema touched.
- Migrations: new numbered file, additive + idempotent only. 029 stays
  parked. Never destructive SQL on prod without written discrepancy + Noah.
- Tier vocabulary frozen: memberships.sales_tier {quarterly,biannual};
  display "Every 3 Months"/"Every 6 Months"/"One-Time Service".
- Anon key = RLS-protected public reads only; service-role = server-only.
- No fake data ever; missing renders as "unknown"/"needs setup".
- Money-path endpoints idempotent (refresh/double-click/webhook replay).
- Signed agreement PDFs immutable. Jobber is scheduling truth (one-way in).
- Founder gates (never do autonomously): merge to main, prod migration,
  deploy, charging/refunding, customer comms, deleting records.
- Commit style: imperative subject, body explains why, co-author trailer:
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

## Loop doctrine
- Bounded cycles: ONE committable unit per cycle, ~30 tool calls max.
- Maker ≠ grader: work is never self-certified; a fresh-context verifier
  subagent judges against written acceptance criteria.
- Memory over context: INDEX.md is the task truth; LESSONS.md is the scar
  tissue. Re-read both at cycle start; append at cycle end. Keep entries
  terse — memory files are for the NEXT cycle's cold start.
- Stop rules beat heroics: 3 fails on one step = BLOCKED + escalate.
