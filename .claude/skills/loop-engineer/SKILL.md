---
name: loop-engineer
description: Run one bounded, verified engineering cycle on the current task using loop memory (.claude/loop/). Use with /loop for autonomous multi-cycle runs, or invoke directly for a single cycle. Args become the task definition on first run.
---

# Loop Engineer — one cycle per invocation

## Cycle protocol (never skip steps)
1. READ memory: .claude/loop/SYSTEM.md, INDEX.md, LESSONS.md, and repo
   AGENTS.md. If args define a new task: decompose it into bounded units
   with written acceptance criteria in INDEX before any work.
2. PICK exactly one TODO unit (topmost unblocked). Mark DOING. If tagged
   route:sol, do not execute — write a self-contained prompt (context,
   constraints, acceptance) to .claude/loop/HANDOFF.md, mark it, and end
   the cycle. That file is for GPT-5.6 Sol or any other model.
3. WORK the unit within budget: ~30 tool calls, one commit-sized change.
   Run tsc + relevant tests yourself first (that is not verification,
   just hygiene).
4. VERIFY — maker ≠ grader: spawn ONE fresh-context subagent
   (general-purpose) with: the unit's acceptance criteria verbatim, the
   diff or file list, and instructions to independently check by reading
   code and running read-only commands (tsc/tests/curl), then return
   exactly `VERDICT: PASS` or `VERDICT: FAIL — <evidence>`. The verifier
   never edits files. The maker never writes its own verdict.
5. RECORD: append cycle row to INDEX (unit, result, verdict, commit hash
   or "uncommitted"); move genuinely new insight to LESSONS (one line,
   cause → rule). Update unit status: DONE on PASS; on FAIL fix and
   re-verify (a fix attempt = a retry).
6. DECIDE:
   - All units DONE → report Definition of Done evidence, then STOP the
     loop (ScheduleWakeup stop:true if running under /loop).
   - Same unit failed 3 times → mark BLOCKED with escalation note under
     "for Noah", skip to next unit; if nothing unblocked remains, STOP.
   - Otherwise continue: under dynamic /loop, schedule the next wakeup
     (60–270s if actively iterating; 1200s+ if waiting on external
     state); pass this same /loop prompt through.

## Hard limits
- Never perform founder-gated actions (merge/deploy/prod
  migration/charges/customer comms) — queue them as escalations.
- Never touch the freeze list or dirty local main's uncommitted work.
- Max 10 cycles per session without a human check-in row in INDEX.
- Secrets never in memory files, prompts, or HANDOFF.md.
