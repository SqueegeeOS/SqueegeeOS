# Jobber J1 Runtime Release Readiness

**Branch:** `codex/jobber-j1-runtime-only`
**Head reviewed:** `49d25c4897ead8d9626ab5a42cb859c8dc234bf8`
**Status:** Draft only; code verified, release blocked
**Scope:** Secure Headquarters runtime, Jobber coverage sync, supervised property linking, per-visit classification, and fail-closed link revocation

## Release decision

Do not merge or deploy this branch yet.

The production schema prerequisites in migrations 035 through 041 were applied
under separate founder approvals and verified read-only. The matching runtime has
not been deployed, and no live Jobber synchronization has been run. Production
therefore has schema capability without permission to claim that Jobber J1 is
operational end to end.

This branch is intentionally a runtime-only release candidate. It must not pull
in migration 043, authoritative visit-completion work, AI behavior, money
movement, obligation fulfillment, or Property Memory writes.

## Product-spine contribution

This release strengthens the current operating spine at:

`active membership -> scheduled Jobber visit -> Member portal / Headquarters truth`

It preserves these owners:

- Jobber owns appointment and dispatch truth.
- HomeAtlas stores observed Jobber state, supervised links, classifications, and
  the authoritative appointment projection.
- Headquarters exposes missing, partial, stale, or disputed state instead of
  inventing a complete schedule.
- Atlas receives no new autonomous authority.

## Included runtime capability

- Individual Supabase-authenticated Headquarters access and active HQ actors.
- Server-authoritative customer, presentation, agreement, and Stripe setup
  boundaries required by the protected Care Operations routes.
- Date-bounded, cursor-complete, read-only Jobber coverage synchronization with
  durable run state and honest complete/partial/indeterminate outcomes.
- Search across Jobber customers and properties so an operator can choose the
  exact signed HomeAtlas member property to link.
- Individual supervised classification of each Jobber visit before it may become
  an authoritative HomeAtlas appointment.
- Atomic property-link revocation that invalidates derived appointment authority
  without deleting evidence.
- Pacific-time appointment presentation shared by Headquarters and the Member
  portal.

## Explicitly excluded

- No automatic classification based on property membership alone.
- No Jobber write operations.
- No live synchronization as part of merge or deployment.
- No billing, Stripe charge, pricing-snapshot, obligation, or Property Memory
  mutation from Jobber sync or classification.
- No authoritative visit-completion or post-visit memory contract.
- No AI-generated decisions or customer communication.

## Production prerequisite ledger

| Migration | Purpose | Production state |
|---|---|---|
| 035 | Authenticated Headquarters access | Applied and read-only verified under a separate founder gate |
| 036 | Close browser authority over customer inputs | Applied and read-only verified under a separate founder gate |
| 037 | Stripe setup authorization | Applied and read-only verified under a separate founder gate |
| 038 | Jobber schedule coverage sync | Applied and read-only verified under a separate founder gate |
| 039 | Supervised visit classification | Applied and read-only verified under a separate founder gate |
| 040 | Member-property search and linking | Applied and read-only verified under a separate founder gate |
| 041 | Fail-closed property-link revocation | Applied and all eight read-only checks passed under a separate founder gate |

The release process must not silently replay or advance the migration sequence.
Any later schema change remains a new founder approval gate.

## Code verification evidence

The runtime-only head plus this documentation-only readiness update passed:

- `npx tsc --noEmit`
- `npm test` — 113 files passed, 667 tests passed; 3 files and 15 tests
  skipped by their declared environment gates
- `npm run lint` — zero errors, 109 existing warnings
- `npm run build` — Next.js 16.2.10 production build passed
- `git diff --check`

`npm run audit:migrations` remains blocked in this worktree because neither
`SUPABASE_DB_URL` nor `DATABASE_URL` is present. Production migrations 035
through 041 were instead applied and checked through founder-approved SQL Editor
gates. The canonical audit must still run against a read-only production
connection or an equivalent founder-reviewed catalog query before readiness.

Before this draft is marked ready, repeat the full suite on a head rebased onto
the latest `main` and record the resulting commit SHA and CI links here.

## Current blockers

1. **Branch freshness:** the published runtime head is 22 commits ahead of and
   five commits behind current remote `main`. Rebase or reconstruct it in a clean
   worktree before readiness review.
2. **Cohesion-map preservation:** current local `main` contains intentional
   founder/Codex changes including `AGENTS.md` and `docs/COHESION_MAP.md`. Release
   preparation must preserve those changes and must not touch the untracked
   `sites/` directory.
3. **Fresh CI:** all type, test, lint, build, migration-audit, and security gates
   must pass on the final rebased SHA.
4. **Environment evidence:** verify names and readiness without exposing values:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `HQ_AUTH_LIMITER_SECRET`,
   `HQ_AUTH_EDGE_RATE_LIMIT_VERIFIED`, `HQ_AUTH_EMERGENCY_DISABLED`,
   `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`,
   `JOBBER_TOKEN_ENCRYPTION_KEY`, `JOBBER_OAUTH_REDIRECT_URI`, and
   `JOBBER_GRAPHQL_VERSION=2025-04-16`.
5. **Runtime envelope:** prove the production host supports the declared
   300-second sync route envelope. The 14-request provider cap stays fail-closed;
   it must not be raised by assumption.
6. **Preview acceptance:** in an isolated preview, verify HQ authentication,
   OAuth callback protection, search, link, sync status, classification,
   revocation, cache headers, and honest partial/stale states.
7. **Independent review:** repeat the Reliability Guardian review on the final
   rebased diff, including RLS, concurrency, stale-source rejection, and the
   forbidden money/obligation/memory domains.

## Ordered release gates

1. Rebase or reconstruct the branch onto current `main` in a clean worktree.
2. Run the complete local and CI verification suite.
3. Verify production environment readiness by name and behavior; do not expose
   secret values.
4. Run the isolated preview acceptance matrix.
5. Obtain founder approval to mark the PR ready.
6. Obtain a separate founder approval to merge.
7. Confirm whether merge automatically deploys; if coupled, stop for a combined
   merge/deployment approval.
8. Deploy with synchronization still disabled.
9. Run read-only post-deploy auth, route, and schema checks.
10. Obtain a separate founder approval for the first real Jobber sync.
11. Review the first sync manifest before approving any visit classification.

## Rollback boundary

- Application rollback: redeploy the last known-good application SHA.
- Emergency HQ shutdown: use `HQ_AUTH_EMERGENCY_DISABLED=1` only under an
  explicit environment/deployment approval.
- Do not roll back by restoring shared-PIN authority.
- Do not delete Jobber observations, classifications, appointment events, or
  property-link evidence.
- Production migrations 035 through 041 remain forward-only schema history;
  rollback is an application/authority decision, not destructive data removal.

## Founder checkpoints still required

- Mark ready for review.
- Merge.
- Deployment or any merge-coupled deployment.
- First real Jobber synchronization.
- Any production visit classification, including Juanita or Shelby.
- Any customer communication, billing, credit, or other money-path action.
