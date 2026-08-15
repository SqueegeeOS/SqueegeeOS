# The Next Arena — owner leverage operating phase

HomeAtlas is moving from an owner-performs-everything business toward an
owner-grows-the-system business. The immediate operating win is concrete:

> Jarad completes one normal field day without Noah physically present, the
> work remains documented and quality-safe, and Noah plus Dasan use the time
> that was genuinely bought back to produce profitable recurring demand.

HomeAtlas coordinates this loop. It should not manufacture progress from taps,
assumptions, or motivational scores.

## Operating destination

- Noah grows the machine.
- HomeAtlas coordinates the machine.
- Jarad and the future field team run normal production.
- Dasan and Noah turn deliberate Growth Hours into signed recurring revenue.
- HQ interrupts an owner only for a verified exception or decision.

The daily management question is:

> How much of the company operated successfully without Noah today?

HomeAtlas answers with separate facts rather than one gameable composite score:
independent jobs and hours, owner interventions, quality exceptions, completed
Growth Hours, and signed attributed ARR.

## Source audit

| Operating fact | Current source | What HomeAtlas can claim | What it must not claim |
| --- | --- | --- | --- |
| Scheduled production | Verified, matched `member_appointments` plus current `jobber_visit_projections` | The Jobber visit, scheduled window, completion state, and exact assigned crew when readable | Freshness while Jobber is disconnected; assignments hidden by provider permissions |
| Actual field execution | Monotonic `technician_visit_events` | Service-start and service-complete duration when both exist | GPS time, productivity, or labor cost |
| Visit proof | `property_assessments` and field-record media | A HomeAtlas closeout exists and whether an open field follow-up remains | Quality solely because a photo or note exists |
| Field independence | HQ review in `field_independence_reviews` | Job class, named assigned technician, owner involvement, owner minutes, quality outcome, and verified duration source | Automatic independence inferred from Jobber completion alone |
| Deliberate growth effort | Timed `growth_work_sessions` | Completed minutes by operator, day, and channel, less recorded breaks | Productivity from an open timer or undocumented off-clock activity |
| New recurring revenue | `sales_rep_attributions` created from a signed agreement | Signed membership annual recurring value attributed to Noah or Dasan | Cash collected, gross profit, or attribution for a presentation with no stable rep lineage |
| Funnel activity | Owner-linked presentations and sales-rep leads | Leads created, presentations started, signed membership closes, and cohort close rate | Universal lead volume or spend efficiency across channels without complete source and cost inputs |
| CAC and gross profit | Not reliably available yet | Nothing yet | CAC, contribution margin, capacity utilization, or valuation multiples |

## KPI contract

### Primary KPI 1 — owner field hours bought back

**Definition**

Sum the verified production minutes for reviews that satisfy every gate below,
then divide by 60:

1. The appointment is a verified and matched Jobber appointment.
2. The current Jobber projection says the visit is complete.
3. The reviewed technician is present in the exact Jobber assignment.
4. A HomeAtlas visit closeout exists.
5. The job is classified as normal, not exceptional.
6. Noah's involvement is `none` and owner minutes are zero.
7. The quality outcome is `verified`.
8. No open field follow-up or customer service case exists.
9. Duration comes from field events when possible, otherwise the Jobber
   schedule. Missing duration counts as zero rather than being estimated.

**Buyback ladder**

- 8 verified hours
- 16 verified hours
- 24 verified hours
- 32 verified hours
- Fully off normal field production, managed through exceptions

Crossing a rung is evidence that the next block can be tested. It is not a
promise to remove Noah from exceptional, unsafe, or inadequately staffed work.

### Primary KPI 2 — signed new ARR per Growth Hour

**Definition**

Signed annual recurring membership value attributed through the stored
presentation → agreement → membership → rep lineage, divided by completed
Growth Hours. Cancelled attribution rows are excluded.

This is sales productivity, not cash, profit, or company valuation.

### Primary KPI 3 — owner-independent normal-job rate

**Definition**

Qualifying independent normal jobs divided by all reviewed normal jobs in the
period. HomeAtlas also exposes the unreviewed completed-and-documented visit
count so an artificially high rate cannot be created by reviewing only wins.

## Drivers

- Completed Growth Hours by Noah and Dasan
- Leads created by operator and source
- Presentations started with stable operator attribution
- Signed memberships and attributed ARR
- Cohort close rate
- Independent jobs and production hours by technician
- Unreviewed completed visits

## Guardrails

- Owner intervention jobs and owner minutes
- Quality exceptions, rework, safety stops, and open service cases
- Missing or unreadable Jobber assignment
- Missing HomeAtlas closeout
- Missing measured duration
- Open Growth Sessions older than 16 hours
- Provider disconnection or stale Jobber truth
- Unattributed closes, which remain excluded rather than assigned by guess

## Growth-day targets

A dedicated Growth Day currently means at least four completed, measured Growth
Hours on the same HomeAtlas business date. This explicit four-hour assumption
allows a genuine half-day growth block during the first buyback rungs and can be
revised later without changing the underlying session ledger.

New signed ARR per dedicated Growth Day:

- Floor: **$500**
- Target: **$1,000**
- Excellent: **$2,000+**

Only ARR attributed on dates that independently reach the four-hour Growth Day
threshold enters this daily average. Off-clock or partial-day closes remain in
weekly new ARR but cannot inflate the dedicated-day result.

If no day reaches four Growth Hours, HomeAtlas shows ARR per Growth Hour but
does not claim a dedicated-day result.

## Daily workflow

### Before production

1. Confirm Jobber is connected and Today shows the expected assignments.
2. Confirm Jarad has a valid Field Pass and the correct route/scope.
3. Resolve assignment or safety ambiguity before the work begins.

### During production

1. Jarad advances the field event sequence and saves the closeout/proof.
2. Noah and Dasan start a Growth Session under the actual channel being worked.
3. They create presentations through their own operator link so future signed
   ARR retains stable attribution.
4. HomeAtlas stays quiet unless an exception needs owner judgment.

### After production

1. Today exposes a review only for completed, documented work.
2. HQ records the actual job class, owner involvement, owner minutes, and
   quality outcome.
3. The one-tap independent action is available only when no field follow-up is
   open; a detailed review remains available for exceptions.
4. Completed reviews feed the buyback ladder. Failed gates remain visible but
   add zero bought-back time.
5. Growth Sessions are finished with break time and optional notes.
6. HQ raises an owner-attention exception for completed visits still awaiting
   review and for Growth Sessions left open eight hours or longer.

## Weekly operating review

1. Review the independent jobs and hours by technician.
2. Clear the unreviewed completed-visit queue.
3. Read every owner intervention and quality exception; look for a training,
   scope, equipment, scheduling, or capacity root cause.
4. Compare completed Growth Hours with signed attributed ARR.
5. Review leads, presentations, closes, close rate, and channel mix.
6. Decide whether to repeat the current buyback rung, advance one rung, or add
   field capacity.
7. When production capacity is the bottleneck, hire/train capacity instead of
   silently returning Noah to permanent field work.

## Risk gates

- This phase does not send a customer message, create a Jobber invoice, close a
  Jobber job, change compensation, or charge a card.
- Field independence is a private operating assessment and must not be shown in
  the customer portal.
- Technician performance facts are private and service-role only.
- The scoreboard fails closed when migration `061` or a supporting source is
  unavailable.
- A Growth Session can count only if completed within 16 hours. A forgotten
  timer can still be cancelled later so the ledger recovers without inventing
  time.
- Jobber disconnection means appointment and crew truth may be stale; reconnect
  and complete a read-only sync before treating the Today board as current.
- Gross profit, CAC, capacity utilization, and enterprise-value multiples are
  intentionally unscored until their inputs are durable and comparable.

## Release boundary

The implementation requires migration `061_owner_leverage_operating_system.sql`
and the matching application release. Apply migrations in order. After release,
use only an internal/non-customer Jobber record to rehearse a completed visit,
closeout, independence review, Growth Session, and signed-attribution display.
No real customer communication or payment is part of that rehearsal.

## Next instrumentation after this phase proves useful

1. A durable labor-cost and technician-capacity ledger.
2. Channel spend tied to lead source for reliable CAC.
3. Training competencies and independent-day readiness by technician.
4. Recurring service gross margin by plan and property complexity.
5. A management-by-exception capacity forecast that recommends when to hire,
   never silently scheduling Noah as the default answer.
