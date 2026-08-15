# Technician Field Automation

HomeAtlas Field Run uses the mirrored Jobber appointment as scheduling and
assignment truth. It adds a private HomeAtlas service timeline without changing
the Jobber visit:

1. On my way
2. Arrived
3. Working
4. Service complete (requires a saved HomeAtlas closeout)
5. Departed

Each technician uses a revocable Field Pass tied to the exact Jobber user ID.
Every write rechecks that the appointment is assigned to that user and remains
inside the bounded field-work window. HQ can watch the same stage and timestamp
on Today.

## Release order

Apply migrations `054` through `058` in order, then deploy the application. The
application fails soft while `058` is missing: Jobber Today and closeout storage
continue working, route actions stay offline, and Production Health names the
missing table.

Migration `058_technician_visit_automation.sql` creates the private event ledger
and its service-role-only, monotonic write function. Repeated taps are safe:
one appointment can have only one event of each stage, and the database prevents
backward or contradictory transitions.

## Customer alerts

On-the-way, arrival, and completion events can store short customer alert copy
with `draft_only` state. This release does not import Twilio or Resend in the
event path and cannot deliver those drafts. A future delivery worker must still
require all of the following before it queues a message:

- approved and registered provider/sender;
- current phone contact point;
- documented SMS consent for the message purpose;
- a post-activation event that has not already been delivered;
- STOP/opt-out suppression and quiet-hours enforcement.

Never bulk-send historical `draft_only` rows.

## Safe acceptance test

Use an internal/demo Jobber client and a dedicated technician Field Pass.

1. Confirm the visit is assigned to the Field Pass user in Jobber.
2. Open `/tech` and advance through On my way, Arrived, and Start service.
3. Save a closeout with one internal test note and no real customer message.
4. Confirm Field Run advances to Service complete automatically.
5. Tap I'm leaving and confirm the next assigned stop becomes the Next action.
6. In `/hq/today`, confirm the same stage, technician, and timestamp appear.
7. Confirm no Twilio/Resend delivery was created and no Jobber visit was mutated.

If the closeout saves but route advancement fails, the closeout remains valid.
Refresh Field Run and use **Mark service complete** to replay the route update.
