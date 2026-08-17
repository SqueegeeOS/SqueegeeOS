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
| Technician readiness | Append-only `technician_competency_assessments`, Field Pass state, and qualifying field reviews | The latest observed level for eight named competencies and whether the evidence file is complete for an owner decision | Automatic approval, an employment decision, or capability inferred from a self-reported tap |
| Independent-day trial | `technician_independent_day_trials` joined to the complete assigned Jobber route and HomeAtlas reviews | Planned date, every assigned stop, completion/review coverage, and a derived verified or exception outcome | A manually declared pass or a result while Jobber assignment evidence is unreadable |
| Technician capacity | Append-only `technician_capacity_plans` joined to four weeks of fresh Jobber visit durations and exact crew assignments | Owner-declared weekly hours, currently booked hours, remaining or overloaded hours, unassigned work, and an optional planning labor-cost estimate | Payroll, earned revenue, gross profit, an automatic hiring decision, or open capacity when Jobber truth is stale/incomplete |
| Deliberate growth effort | Timed `growth_work_sessions` | Completed minutes by operator, day, and channel, less recorded breaks | Productivity from an open timer or undocumented off-clock activity |
| New recurring revenue | `sales_rep_attributions` created from a signed agreement | Signed membership annual recurring value attributed to Noah or Dasan | Cash collected, gross profit, or attribution for a presentation with no stable rep lineage |
| Sales-to-production handoff | The signed attribution’s membership plus `jobber_property_links`, `jobber_membership_job_links`, and a fresh full `jobber_visit_projections` snapshot | Whether the close has payment readiness, an active property pairing, at least one classified recurring job, and an upcoming linked visit | That a stale or disconnected Jobber source means no visit exists; that every possible add-on job has been classified |
| Funnel activity | Owner-linked presentations and sales-rep leads | Leads created, presentations started, signed membership closes, and cohort close rate | Universal lead volume or spend efficiency across channels without complete source and cost inputs |
| CAC and gross profit | Not reliably available yet | Nothing yet | CAC, contribution margin, or valuation multiples |

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
- Declared, booked, and remaining production hours by technician and week
- Unreviewed completed visits

## Guardrails

- Owner intervention jobs and owner minutes
- Quality exceptions, rework, safety stops, and open service cases
- Missing or unreadable Jobber assignment
- Missing HomeAtlas closeout
- Missing measured duration
- Open Growth Sessions older than 16 hours
- Provider disconnection or stale Jobber truth
- Undeclared technician hours, scheduled work without a technician, and booked
  demand beyond declared field capacity
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

## Independent-day readiness contract

Readiness is a private evidence file, not an automatic approval. HomeAtlas
shows “evidence complete for Noah’s decision” only when all three gates are
true:

1. The technician has a usable assignment-bounded Field Pass.
2. The latest append-only observation for each of eight competencies is
   `independent`: route ownership, scope/property context, equipment/setup,
   safety/stop-work judgment, service quality, customer handoff,
   closeout/proof, and exception escalation.
3. At least one normal, quality-verified, measured visit with zero owner help
   and no open field/customer exception exists.

When Noah plans a full independent day, the date is recorded but the result is
not editable. HomeAtlas reads every Jobber stop assigned to that technician on
the date. The day verifies only if every assigned stop is complete, every stop
has a HomeAtlas independence review, and every review satisfies the bought-back
time contract. A missing route, missing review, owner assist, rework, safety
stop, open exception, disconnected Jobber account, or unreadable assignment
becomes an explicit outcome and owner-attention item rather than a silent pass.
The latest full Jobber projection must also be no older than six hours.

## Four-week capacity contract

Capacity is a planning comparison, not a forecast invented by HomeAtlas:

1. Noah declares the production hours a technician can actually work beginning
   on a Monday. A newer effective plan supersedes the view without deleting the
   prior assumption.
2. HomeAtlas reads four current business weeks of Jobber visits. Each assigned
   technician consumes the visit duration; an unassigned visit still consumes
   one visit-duration block of team capacity.
3. Remaining capacity is declared minutes minus visible scheduled crew minutes.
   Overload begins only when that exact result is negative; there is no hidden
   utilization threshold.
4. Missing duration, unreadable assignment, stale or disconnected Jobber data,
   a failed schedule query, or a truncated result makes the affected runway
   unknown rather than zero.
5. The optional labor-cost field—currently expected to be around $25/hour for
   Jarad—is an owner planning assumption. It is not payroll or proof of loaded
   labor cost, and the schedule is not earned revenue.
6. Missing declarations, unassigned stops, unknown source weeks, and overload
   rise into owner attention. HomeAtlas never assigns Noah as the fallback.

## Signed-to-scheduled handoff contract

A signed close becomes production ready only when five independent proofs are
present:

1. A completed agreement created the durable salesperson attribution.
2. The exact membership has safe payment evidence and resolves as active under
   the canonical membership lifecycle.
3. The membership property has one active, supervised Jobber property link.
4. At least one observed recurring Jobber job is explicitly classified to that
   same membership and property.
5. A current full Jobber snapshot contains an upcoming, non-cancelled visit on
   one of those linked jobs.

The `/david` close card shows the verified step count and the next safe action.
Owner attention ranks payment and lifecycle failures as critical, then routes
pairing, recurring-job, and scheduling gaps. If Jobber is disconnected or its
latest snapshot is older than six hours, the fifth proof is **unknown**. Stored
visits may still be displayed elsewhere as historical context, but HomeAtlas
must not label the member unscheduled from stale evidence.

## Daily workflow

### Before production

1. Confirm Jobber is connected and Today shows the expected assignments.
2. Open Team and confirm Jarad’s current Field Pass, eight-skill evidence,
   independent-visit gate, and declared production hours.
3. Read the four-week runway; resolve unknown, unassigned, or overloaded work
   before promising more capacity.
4. Plan the trial date in HomeAtlas, then build the real normal route in Jobber.
5. Resolve assignment or safety ambiguity before the work begins.

### During production

1. Jarad advances the field event sequence and saves the closeout/proof.
2. Noah and Dasan start a Growth Session under the actual channel being worked.
3. They create presentations through their own operator link so future signed
   ARR retains stable attribution.
4. A visible, online sales phone refreshes its owned queue every 90 seconds and
   on focus or reconnect. Overdue, due-today, and unscheduled relationships rise
   as one next-move card; future follow-ups stay in the full queue. This read
   never calls, texts, emails, schedules, enrolls, invoices, or charges.
5. HomeAtlas stays quiet unless an exception needs owner judgment.

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
   review, an incomplete/failed independent-day trial, and Growth Sessions left
   open eight hours or longer.
7. Capacity exceptions rise without scheduling Noah or mutating Jobber.

### After a signed sale

1. The completed agreement creates the salesperson attribution automatically.
2. Open the verified close in David’s workspace; never add a manual signed
   counter or duplicate customer record.
3. Complete payment setup and resolve the membership lifecycle.
4. Pair the exact HomeAtlas property, then classify the intended recurring
   Jobber job.
5. Create the real visit in Jobber. HomeAtlas verifies the next visit only
   after a current full read-only sync.
6. Work any incomplete handoff from owner attention. The handoff view itself
   does not send, charge, schedule, close, or invoice anything.

## Weekly operating review

1. Review the independent jobs and hours by technician.
2. Clear the unreviewed completed-visit queue.
3. Read every owner intervention and quality exception; look for a training,
   scope, equipment, scheduling, or capacity root cause.
4. Compare completed Growth Hours with signed attributed ARR.
5. Review leads, presentations, closes, close rate, and channel mix.
6. Clear signed-member payment, pairing, recurring-job, and scheduling handoff
   gaps before counting new ARR as operationally absorbed.
7. Review the next four weeks of declared, booked, unassigned, and remaining
   technician hours.
8. Decide whether to repeat the current buyback rung, advance one rung, or add
   field capacity.
9. When production capacity is the bottleneck, hire/train capacity instead of
   silently returning Noah to permanent field work.

## Risk gates

- This phase does not send a customer message, create a Jobber invoice, close a
  Jobber job, change compensation, or charge a card.
- Field independence is a private operating assessment and must not be shown in
  the customer portal.
- Technician performance facts are private and service-role only.
- The scoreboard, readiness file, and capacity runway fail closed when migration
  `061`, `062`, `063`, or a supporting source is unavailable.
- A Growth Session can count only if completed within 16 hours. A forgotten
  timer can still be cancelled later so the ledger recovers without inventing
  time.
- Jobber disconnection means appointment and crew truth may be stale; reconnect
  and complete a read-only sync before treating the Today board as current.
- Gross profit, CAC, and enterprise-value multiples are intentionally unscored
  until their inputs are durable and comparable. Capacity utilization is shown
  only as current scheduled minutes divided by an owner-declared plan.

## Release boundary

The implementation requires migrations
`061_owner_leverage_operating_system.sql` and
`062_technician_readiness_and_independent_day.sql`, and
`063_technician_capacity_planning.sql` plus the matching application
release. Apply migrations in order. After release, use only an
internal/non-customer Jobber record to rehearse a completed visit, closeout,
independence review, eight-skill evidence, full independent-day trial, declared
capacity, four-week runway, Growth Session, and signed-attribution display. No
real customer communication or payment is part of that rehearsal.

## Next instrumentation after this phase proves useful

1. A durable payroll/loaded-labor source that can replace optional planning cost
   without rewriting the capacity history.
2. Channel spend tied to lead source for reliable CAC.
3. Training-remediation history tied to recurring competency gaps and route
   exceptions.
4. Recurring service gross margin by plan and property complexity.
5. Hiring lead-time and demand-pipeline inputs that can recommend when to add
   capacity without inventing bookings or silently scheduling Noah.
