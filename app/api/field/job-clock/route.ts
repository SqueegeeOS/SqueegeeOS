import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import {
  assertFieldActorCanWriteAppointment,
  assertTechnicianAssignedToFieldAssignment,
} from "@/lib/field-operations/field-scope";
import {
  assertTechnicianCanFinishJob,
  recordTechnicianJobClockAction,
} from "@/lib/field-operations/technician-job-clock-server";
import {
  loadTechnicianVisitEventSnapshots,
  recordTechnicianVisitEvent,
} from "@/lib/field-operations/technician-visit-event-server";
import {
  technicianVisitStageOrder,
  type TechnicianVisitEventType,
} from "@/lib/field-operations/technician-visit-events";
import {
  validateTechnicianJobClockRequest,
  type TechnicianJobClockRequest,
} from "@/lib/field-operations/technician-job-clock";

export const runtime = "nodejs";

const START_LIFECYCLE: TechnicianVisitEventType[] = [
  "en_route",
  "arrived",
  "service_started",
];

async function advanceLifecycle(input: {
  actor: NonNullable<Awaited<ReturnType<typeof authorizeFieldRequest>>>;
  propertyId: string;
  appointmentId: string;
  target: "service_started" | "departed";
}): Promise<void> {
  const snapshots = await loadTechnicianVisitEventSnapshots([
    input.appointmentId,
  ]);
  if (!snapshots.available) {
    throw new Error("Technician route automation is not ready yet.");
  }
  let stage =
    snapshots.byAppointmentId.get(input.appointmentId)?.stage ?? "not_started";
  const desiredEvents =
    input.target === "service_started"
      ? START_LIFECYCLE
      : (["service_completed", "departed"] as TechnicianVisitEventType[]);

  for (const eventType of desiredEvents) {
    if (technicianVisitStageOrder(stage) >= technicianVisitStageOrder(eventType)) {
      continue;
    }
    await recordTechnicianVisitEvent({
      request: {
        eventId: randomUUID(),
        propertyId: input.propertyId,
        appointmentId: input.appointmentId,
        eventType,
      },
      actor: input.actor,
      source: "field_action",
    });
    stage = eventType;
  }
}

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor) {
    return NextResponse.json({ error: "Field Pass required" }, { status: 401 });
  }

  try {
    const submitted = (await request.json()) as TechnicianJobClockRequest;
    const validationError = validateTechnicianJobClockRequest(submitted);
    if (validationError) throw new Error(validationError);
    if (submitted.fieldAssignmentId) {
      await assertTechnicianAssignedToFieldAssignment(
        actor,
        submitted.fieldAssignmentId,
      );
    } else {
      await assertFieldActorCanWriteAppointment(
        actor,
        submitted.propertyId!,
        submitted.appointmentId!,
      );
      if (submitted.action === "finish") {
        await assertTechnicianCanFinishJob(submitted.appointmentId!);
      }
    }
    const result = await recordTechnicianJobClockAction({
      request: submitted,
      actor,
    });
    let routeEventRecorded = true;
    let routeEventWarning: string | null = null;
    const fieldStage = result.clock.state === "finished" ? "departed" : "service_started";
    if (!submitted.fieldAssignmentId) {
      try {
        await advanceLifecycle({
          actor,
          propertyId: submitted.propertyId!,
          appointmentId: submitted.appointmentId!,
          target: fieldStage,
        });
      } catch (error) {
        // The durable time write already succeeded. Never tell the technician
        // that clock-in/out failed just because the secondary timeline failed.
        routeEventRecorded = false;
        routeEventWarning = "Your job time is saved. The visit timeline still needs an HQ check.";
        console.warn("[field-job-clock] time saved without route event:",
          error instanceof Error ? error.message : "unknown route event error");
      }
    }
    return NextResponse.json({
      ...result,
      routeEventRecorded,
      routeEventWarning,
      ...(routeEventRecorded ? {
        fieldStage,
      } : {}),
    }, {
      status: result.replayed ? 200 : 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the job clock.";
    const forbidden =
      /not assigned|not available to this Field Pass|outside the safe|no longer active/i.test(
        message,
      );
    const conflict = /start the job clock before finishing|closeout before clocking out|other active job/i.test(message);
    const invalid =
      /valid|not found|does not belong|not a verified Jobber stop/i.test(message);
    const status = forbidden ? 403 : conflict ? 409 : invalid ? 400 : 503;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
