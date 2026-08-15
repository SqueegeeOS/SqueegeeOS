export const TECHNICIAN_VISIT_EVENT_TYPES = [
  "en_route",
  "arrived",
  "service_started",
  "service_completed",
  "departed",
] as const;

export type TechnicianVisitEventType =
  (typeof TECHNICIAN_VISIT_EVENT_TYPES)[number];

export type TechnicianVisitStage =
  | "not_started"
  | TechnicianVisitEventType;

export type TechnicianVisitEventSource = "field_action" | "closeout";

export interface TechnicianVisitEventRequest {
  eventId: string;
  propertyId: string;
  appointmentId: string;
  eventType: TechnicianVisitEventType;
}

export interface TechnicianVisitEventSnapshot {
  stage: TechnicianVisitStage;
  occurredAt: string | null;
  actorDisplayName: string | null;
  eventCount: number;
}

export type TechnicianVisitNextAction =
  | {
      kind: "event";
      eventType: TechnicianVisitEventType;
      label: string;
      detail: string;
    }
  | {
      kind: "closeout";
      label: string;
      detail: string;
    }
  | null;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STAGE_ORDER: Record<TechnicianVisitStage, number> = {
  not_started: 0,
  en_route: 1,
  arrived: 2,
  service_started: 3,
  service_completed: 4,
  departed: 5,
};

const STAGE_LABEL: Record<TechnicianVisitStage, string> = {
  not_started: "Not started",
  en_route: "On the way",
  arrived: "Arrived",
  service_started: "Working",
  service_completed: "Service complete",
  departed: "Departed",
};

export function isTechnicianVisitEventType(
  value: unknown,
): value is TechnicianVisitEventType {
  return TECHNICIAN_VISIT_EVENT_TYPES.includes(
    value as TechnicianVisitEventType,
  );
}

export function technicianVisitStageOrder(stage: TechnicianVisitStage): number {
  return STAGE_ORDER[stage];
}

export function technicianVisitStageLabel(stage: TechnicianVisitStage): string {
  return STAGE_LABEL[stage];
}

export function technicianVisitStageProgress(
  stage: TechnicianVisitStage,
): { completed: number; total: number } {
  return { completed: STAGE_ORDER[stage], total: 5 };
}

export function resolveTechnicianVisitSnapshot(
  events: Array<{
    eventType: TechnicianVisitEventType;
    occurredAt: string;
    actorDisplayName: string;
  }>,
): TechnicianVisitEventSnapshot {
  const ordered = [...events].sort((left, right) => {
    const stageDifference =
      STAGE_ORDER[right.eventType] - STAGE_ORDER[left.eventType];
    if (stageDifference !== 0) return stageDifference;
    return Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  });
  const latest = ordered[0];
  return latest
    ? {
        stage: latest.eventType,
        occurredAt: latest.occurredAt,
        actorDisplayName: latest.actorDisplayName,
        eventCount: events.length,
      }
    : {
        stage: "not_started",
        occurredAt: null,
        actorDisplayName: null,
        eventCount: 0,
      };
}

export function resolveTechnicianVisitNextAction(input: {
  stage: TechnicianVisitStage;
  hasFieldRecord: boolean;
  jobberComplete: boolean;
}): TechnicianVisitNextAction {
  switch (input.stage) {
    case "not_started":
      if (input.jobberComplete) {
        return input.hasFieldRecord
          ? {
              kind: "event",
              eventType: "service_completed",
              label: "Confirm service complete",
              detail: "Use the existing closeout to repair this route timeline.",
            }
          : {
              kind: "closeout",
              label: "Finish required closeout",
              detail: "Jobber is complete; save HomeAtlas proof before leaving.",
            };
      }
      return {
        kind: "event",
        eventType: "en_route",
        label: "On my way",
        detail: "Start this stop and prepare the customer arrival update.",
      };
    case "en_route":
      return {
        kind: "event",
        eventType: "arrived",
        label: "I’ve arrived",
        detail: "Record arrival before work begins.",
      };
    case "arrived":
      return {
        kind: "event",
        eventType: "service_started",
        label: "Start service",
        detail: "Move this home into active work.",
      };
    case "service_started":
      return input.hasFieldRecord
        ? {
            kind: "event",
            eventType: "service_completed",
            label: "Mark service complete",
            detail: "A closeout already exists; advance the route safely.",
          }
        : {
            kind: "closeout",
            label: "Finish service & close out",
            detail: "Save notes, work completed, and customer-approved proof.",
          };
    case "service_completed":
      return {
        kind: "event",
        eventType: "departed",
        label: "I’m leaving",
        detail: "Finish this stop and move the route to the next home.",
      };
    case "departed":
      return null;
  }
}

export function validateTechnicianVisitEventRequest(
  value: unknown,
): string | null {
  if (!value || typeof value !== "object") {
    return "Choose a valid technician route action.";
  }
  const input = value as Partial<TechnicianVisitEventRequest>;
  if (!UUID_PATTERN.test(input.eventId ?? "")) {
    return "The technician route action needs a valid event ID.";
  }
  if (!UUID_PATTERN.test(input.propertyId ?? "")) {
    return "Choose a valid HomeAtlas property.";
  }
  if (!UUID_PATTERN.test(input.appointmentId ?? "")) {
    return "Choose a valid HomeAtlas appointment.";
  }
  if (!isTechnicianVisitEventType(input.eventType)) {
    return "Choose a valid technician route stage.";
  }
  return null;
}

function firstName(value: string): string {
  const candidate = value.trim().split(/\s+/)[0];
  return candidate && candidate.length <= 24 ? candidate : "there";
}

function compactServiceLabel(value: string | null): string {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized && normalized.length <= 50
    ? normalized
    : "scheduled home service";
}

export function buildTechnicianCustomerAlertDraft(input: {
  eventType: TechnicianVisitEventType;
  clientName: string;
  serviceLabel: string | null;
}): string | null {
  const greeting = firstName(input.clientName);
  const service = compactServiceLabel(input.serviceLabel);
  switch (input.eventType) {
    case "en_route":
      return `Hi ${greeting}, SqueegeeKing is on the way for today's ${service}. Reply with any access notes.`;
    case "arrived":
      return `Hi ${greeting}, SqueegeeKing has arrived for today's ${service}.`;
    case "service_completed":
      return `Hi ${greeting}, today's ${service} is complete. Approved notes and photos will appear in HomeAtlas.`;
    case "service_started":
    case "departed":
      return null;
  }
}

export function isMissingTechnicianVisitEventSchema(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    ((message.includes("technician_visit_events") ||
      message.includes("record_technician_visit_event")) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}
