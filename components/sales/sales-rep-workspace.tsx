"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import {
  DoorMemorySheet,
  DoorMemoryTimeline,
  type DoorMemoryDraft,
} from "@/components/sales/door-memory";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  buildStandardRepProfile,
  DAVID_REP_PROFILE,
  getMilestoneProgress,
  type SalesRepProfile,
} from "@/lib/sales/rep-config";
import type {
  CreateSalesLeadInput,
  SalesActivityReceipt,
  SalesActivityType,
  SalesDoorMemory,
  SalesDoorMemoryReceipt,
  SalesRepLead,
  SalesRepRecentWin,
  SalesWorkspaceMetrics,
  SalesWorkspacePayload,
  UpdateSalesLeadInput,
} from "@/lib/sales/workspace-types";
import {
  salesDoorDispositionCountsConversation,
  type SalesDoorDisposition,
} from "@/lib/sales/door-memory";
import {
  craftEyebrow,
  craftHeading,
  craftInput,
  craftLabel,
  craftPrimaryButton,
  craftSecondaryButton,
  craftTextarea,
} from "@/lib/craft/tokens";
import {
  buildSalesLeadActionQueue,
  summarizeSalesLeadActionQueue,
  type SalesLeadActionMoment,
} from "@/lib/sales/lead-action-priority";
import {
  filterSalesLeadActionQueue,
  type SalesLeadQueueFilter,
} from "@/lib/sales/lead-action-filter";
import { presentationWorkspacePath } from "@/lib/presentations/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface SalesRepWorkspaceProps {
  repSlug: string;
  sessionKind: "admin" | "sales_rep";
  closedPresentationId?: string | null;
}

interface ActivityMutationResponse {
  activity?: SalesActivityReceipt;
  error?: string;
  message?: string;
}

interface LeadMutationResponse {
  lead?: SalesRepLead;
  error?: string;
  message?: string;
}

interface DoorMemoryMutationResponse {
  memory?: SalesDoorMemoryReceipt;
  error?: string;
  message?: string;
}

interface PresentationMutationResponse {
  presentation?: { id: string; status?: string | null };
  error?: string;
  resumed?: boolean;
}

interface OfflinePulseActivityEntry {
  kind: "activity";
  activityType: ManualPulseActivity;
  clientEventId: string;
  createdAt: string;
}

interface OfflineDoorMemoryEntry {
  kind: "door_memory";
  clientEventId: string;
  doorActivityClientEventId: string;
  propertyAddress: string;
  disposition: SalesDoorDisposition;
  notes: string;
  createdAt: string;
}

type OfflinePulseEntry = OfflinePulseActivityEntry | OfflineDoorMemoryEntry;

interface FixedDoorFeedback {
  mode: "queued" | "synced" | "error";
  message: string;
  activity?: SalesActivityReceipt;
  clientEventId?: string;
}

interface LeadActionDraft {
  status: UpdateSalesLeadInput["status"];
  estimatedArrDollars: number;
  nextFollowUpAt: string;
  notes: string;
}

const EMPTY_METRICS: SalesWorkspaceMetrics = {
  doorsToday: 0,
  conversationsToday: 0,
  presentationsToday: 0,
  leadsToday: 0,
  signedToday: 0,
  openPipelineCount: 0,
  pipelineArrCents: 0,
  qualifiedRetainedMembers: 0,
  closedArrCents: 0,
  closedArrTodayCents: 0,
};
const EMPTY_LEADS: SalesRepLead[] = [];
const EMPTY_RECENT_WINS: SalesRepRecentWin[] = [];
const EMPTY_DOOR_MEMORIES: SalesDoorMemory[] = [];

const EMPTY_LEAD_FORM: CreateSalesLeadInput = {
  fullName: "",
  propertyAddress: "",
  phone: "",
  email: "",
  estimatedArrDollars: 1200,
  nextFollowUpAt: "",
  notes: "",
  smsConsentAttested: false,
  emailConsentAttested: false,
  doorMemoryClientEventId: null,
};

type ManualPulseActivity =
  | "door_knock"
  | "conversation"
  | "presentation_started";

const FIELD_DISPLAY_STORAGE_KEY = "homeatlas.field-display.v1";
const OFFLINE_PULSE_STORAGE_KEY = "homeatlas.field-pulse-queue.v1";
const MANUAL_PULSE_TYPES = new Set<ManualPulseActivity>([
  "door_knock",
  "conversation",
  "presentation_started",
]);
const PACIFIC_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const RECENT_WIN_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const HANDOFF_VISIT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const RECENT_WIN_STATUS: Record<
  SalesRepRecentWin["status"],
  { label: string; className: string }
> = {
  pending: {
    label: "Signed",
    className: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
  },
  active: {
    label: "Activated",
    className: "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100",
  },
  qualified: {
    label: "12-mo qualified",
    className: "border-accent/30 bg-accent/[0.08] text-accent",
  },
};

const PRODUCTION_HANDOFF_STYLE: Record<
  NonNullable<SalesRepRecentWin["productionHandoff"]>["stage"],
  string
> = {
  payment_needed: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
  membership_attention: "border-red-300/30 bg-red-300/[0.08] text-red-100",
  property_pairing_needed: "border-sky-300/25 bg-sky-300/[0.07] text-sky-100",
  job_pairing_needed: "border-sky-300/25 bg-sky-300/[0.07] text-sky-100",
  source_unavailable: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
  schedule_needed: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
  ready: "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100",
};

const QUICK_ACTIONS: Array<{
  type: ManualPulseActivity;
  label: string;
  detail: string;
  metric: "doorsToday" | "conversationsToday" | "presentationsToday";
  wide?: boolean;
}> = [
  {
    type: "door_knock",
    label: "Next door",
    detail: "Log one knock",
    metric: "doorsToday",
    wide: true,
  },
  {
    type: "conversation",
    label: "Extra talk",
    detail: "No saved door",
    metric: "conversationsToday",
  },
  {
    type: "presentation_started",
    label: "Presented",
    detail: "Log full pitch",
    metric: "presentationsToday",
  },
];

const LEAD_STAGE_OPTIONS: Array<{
  value: LeadActionDraft["status"];
  label: string;
}> = [
  { value: "new", label: "New conversation" },
  { value: "follow_up", label: "Follow up" },
  { value: "presentation", label: "Presentation ready" },
  { value: "considering", label: "Customer considering" },
  { value: "lost", label: "Closed / not moving forward" },
];

const NEXT_ACTION_STYLES: Record<
  SalesLeadActionMoment,
  { label: string; className: string }
> = {
  overdue: {
    label: "Overdue",
    className: "border-red-300/30 bg-red-300/[0.08] text-red-100",
  },
  due_today: {
    label: "Due today",
    className: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
  },
  unscheduled: {
    label: "Needs next move",
    className: "border-sky-300/25 bg-sky-300/[0.07] text-sky-100",
  },
  upcoming: {
    label: "Upcoming",
    className: "border-white/[0.08] bg-white/[0.025] text-muted",
  },
};

const FOLLOW_UP_SHORTCUTS = [
  { days: 0, label: "Today 5 PM" },
  { days: 1, label: "Tomorrow" },
  { days: 7, label: "Next week" },
] as const;

function offlinePulseStorageKey(repSlug: string) {
  return `${OFFLINE_PULSE_STORAGE_KEY}.${repSlug.trim().toLowerCase()}`;
}

function readOfflinePulseQueue(repSlug: string) {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(offlinePulseStorageKey(repSlug)) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): OfflinePulseEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Record<string, unknown>;
      if (
        candidate.kind === "door_memory" &&
        typeof candidate.clientEventId === "string" &&
        typeof candidate.doorActivityClientEventId === "string" &&
        typeof candidate.propertyAddress === "string" &&
        typeof candidate.disposition === "string" &&
        [
          "not_home",
          "conversation",
          "follow_up",
          "interested",
          "not_interested",
          "do_not_knock",
        ].includes(candidate.disposition) &&
        typeof candidate.notes === "string" &&
        typeof candidate.createdAt === "string"
      ) {
        return [candidate as unknown as OfflineDoorMemoryEntry];
      }

      // Entries written before Door Memory did not carry a discriminant. Keep
      // them safe and upgrade their shape the next time the queue is written.
      if (
        (candidate.kind === undefined || candidate.kind === "activity") &&
        typeof candidate.clientEventId === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.activityType === "string" &&
        MANUAL_PULSE_TYPES.has(candidate.activityType as ManualPulseActivity)
      ) {
        return [
          {
            kind: "activity",
            activityType: candidate.activityType as ManualPulseActivity,
            clientEventId: candidate.clientEventId,
            createdAt: candidate.createdAt,
          },
        ];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function writeOfflinePulseQueue(repSlug: string, queue: OfflinePulseEntry[]) {
  try {
    window.localStorage.setItem(
      offlinePulseStorageKey(repSlug),
      JSON.stringify(queue),
    );
    return true;
  } catch {
    return false;
  }
}

function isPacificToday(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return PACIFIC_DAY_FORMATTER.format(date) === PACIFIC_DAY_FORMATTER.format(new Date());
}

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackProfile(repSlug: string): SalesRepProfile {
  const slug = repSlug.trim().toLowerCase();
  if (slug === "david") return DAVID_REP_PROFILE;
  return buildStandardRepProfile({
    slug,
    displayName: titleCaseSlug(slug) || "Field Rep",
  });
}

function moneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function followUpLabel(value: string | null) {
  if (!value) return "No follow-up set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Follow-up time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function localDateTimeInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function suggestedFollowUpValue(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(daysFromNow === 0 ? 17 : 10, 0, 0, 0);
  return localDateTimeInputValue(date.toISOString());
}

function statusLabel(status: SalesRepLead["status"]) {
  return status.replaceAll("_", " ");
}

function recentWinDateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? RECENT_WIN_DATE_FORMATTER.format(date)
    : "Date unavailable";
}

function handoffVisitDateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? HANDOFF_VISIT_DATE_FORMATTER.format(date)
    : "Visit time unavailable";
}

async function fetchSalesWorkspace(repSlug: string): Promise<SalesWorkspacePayload> {
  const response = await fetch(
    `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | (SalesWorkspacePayload & { error?: string })
    | null;
  if (!response.ok || !body?.profile) {
    throw new Error(body?.error ?? "Could not load the private field desk.");
  }
  return body;
}

export function SalesRepWorkspace({
  repSlug,
  sessionKind,
  closedPresentationId = null,
}: SalesRepWorkspaceProps) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<SalesWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activityPending, setActivityPending] = useState<SalesActivityType | null>(null);
  const [undoableActivity, setUndoableActivity] = useState<SalesActivityReceipt | null>(null);
  const [undoPending, setUndoPending] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadForm, setLeadForm] = useState<CreateSalesLeadInput>(EMPTY_LEAD_FORM);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadSaveIntent, setLeadSaveIntent] = useState<
    "follow-up" | "build-plan" | null
  >(null);
  const [presentationOpeningLeadId, setPresentationOpeningLeadId] = useState<
    string | null
  >(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadActionDraft, setLeadActionDraft] = useState<LeadActionDraft | null>(
    null,
  );
  const [leadActionSaving, setLeadActionSaving] = useState(false);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [leadQueueFilter, setLeadQueueFilter] =
    useState<SalesLeadQueueFilter>("all");
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [actionClock, setActionClock] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [sunlightMode, setSunlightMode] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflinePulseEntry[]>([]);
  const [offlineSyncing, setOfflineSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const offlineSyncingRef = useRef(false);
  const offlineQueueRef = useRef<OfflinePulseEntry[]>([]);
  const [fixedDoorFeedback, setFixedDoorFeedback] =
    useState<FixedDoorFeedback | null>(null);
  const [doorMemoryDraft, setDoorMemoryDraft] =
    useState<DoorMemoryDraft | null>(null);
  const [doorMemorySaving, setDoorMemorySaving] = useState(false);

  const profile = workspace?.profile ?? fallbackProfile(repSlug);
  const metrics = workspace?.metrics ?? EMPTY_METRICS;
  const totalsArePartial = workspaceLoadError !== null;
  const milestone = useMemo(
    () => getMilestoneProgress(profile, metrics.qualifiedRetainedMembers),
    [metrics.qualifiedRetainedMembers, profile],
  );
  const queuedPulseTotals = useMemo(
    () =>
      offlineQueue.filter((entry) => isPacificToday(entry.createdAt)).reduce(
        (totals, entry) => {
          if (entry.kind === "door_memory") {
            if (salesDoorDispositionCountsConversation(entry.disposition)) {
              totals.conversationsToday += 1;
            }
            return totals;
          }
          if (entry.activityType === "door_knock") totals.doorsToday += 1;
          if (entry.activityType === "conversation") {
            totals.conversationsToday += 1;
          }
          if (entry.activityType === "presentation_started") {
            totals.presentationsToday += 1;
          }
          return totals;
        },
        { doorsToday: 0, conversationsToday: 0, presentationsToday: 0 },
      ),
    [offlineQueue],
  );

  const loadWorkspace = useCallback(async () => {
    try {
      setWorkspace(await fetchSalesWorkspace(repSlug));
      setWorkspaceLoadError(null);
    } catch (loadError) {
      setWorkspaceLoadError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the private field desk.",
      );
    } finally {
      setLoading(false);
    }
  }, [repSlug]);

  useEffect(() => {
    let cancelled = false;
    fetchSalesWorkspace(repSlug)
      .then((payload) => {
        if (!cancelled) {
          setWorkspace(payload);
          setWorkspaceLoadError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setWorkspaceLoadError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the private field desk.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repSlug]);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateStandaloneState = () => {
      setIsStandalone(displayMode.matches || nav.standalone === true);
    };
    updateStandaloneState();
    displayMode.addEventListener("change", updateStandaloneState);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => {
      displayMode.removeEventListener("change", updateStandaloneState);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setSunlightMode(
          window.localStorage.getItem(FIELD_DISPLAY_STORAGE_KEY) === "sunlight",
        );
      } catch {
        // Storage can be unavailable in private browsing; standard mode still works.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!notice || undoableActivity) return;

    const timeout = window.setTimeout(() => setNotice(null), 5_000);
    return () => window.clearTimeout(timeout);
  }, [notice, undoableActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => setActionClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!undoableActivity) return;

    if (!undoableActivity.undoExpiresAt) return;
    const expiresAt = Date.parse(undoableActivity.undoExpiresAt);
    if (!Number.isFinite(expiresAt)) return;
    const remaining = expiresAt - Date.now();
    const timeout = window.setTimeout(
      () => setUndoableActivity(null),
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timeout);
  }, [undoableActivity]);

  useEffect(() => {
    if (!fixedDoorFeedback) return;
    const timeout = window.setTimeout(() => setFixedDoorFeedback(null), 8_000);
    return () => window.clearTimeout(timeout);
  }, [fixedDoorFeedback]);

  const installWorkspace = async () => {
    setInstallHelp(null);
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setIsStandalone(true);
      setInstallPrompt(null);
      return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setInstallHelp(
      isIos
        ? "On iPhone: tap Share, then Add to Home Screen, then Add."
        : "Open your browser menu and choose Install app or Add to Home screen.",
    );
  };

  const toggleSunlightMode = () => {
    setSunlightMode((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          FIELD_DISPLAY_STORAGE_KEY,
          next ? "sunlight" : "standard",
        );
      } catch {
        // The display preference remains active for this session.
      }
      return next;
    });
  };

  const clearFeedback = () => {
    setNotice(null);
    setError(null);
    setUndoableActivity(null);
  };

  const commitOfflineQueue = useCallback(
    (next: OfflinePulseEntry[]) => {
      if (!writeOfflinePulseQueue(repSlug, next)) return false;
      offlineQueueRef.current = next;
      setOfflineQueue(next);
      return true;
    },
    [repSlug],
  );

  const removeQueuedActivity = useCallback(
    (clientEventId: string) => {
      const target = offlineQueueRef.current.find(
        (entry) => entry.clientEventId === clientEventId,
      );
      const next = offlineQueueRef.current.filter(
        (entry) =>
          entry.clientEventId !== clientEventId &&
          !(
            target?.kind === "activity" &&
            entry.kind === "door_memory" &&
            entry.doorActivityClientEventId === target.clientEventId
          ),
      );
      if (!commitOfflineQueue(next)) {
        setSyncError(
          "This phone could not update its saved field queue. Nothing was removed.",
        );
        return false;
      }

      setSyncError(null);
      setFixedDoorFeedback((current) =>
        current?.clientEventId === clientEventId ? null : current,
      );
      return true;
    },
    [commitOfflineQueue],
  );

  const undoLastQueuedActivity = () => {
    const entry = offlineQueueRef.current.at(-1);
    if (!entry || !removeQueuedActivity(entry.clientEventId)) return;
    setNotice("The latest phone-only entry was removed before syncing.");
    navigator.vibrate?.(10);
  };

  const discardOldestQueuedActivity = () => {
    const entry = offlineQueueRef.current[0];
    if (!entry || !removeQueuedActivity(entry.clientEventId)) return;
    setNotice(
      "The oldest stuck phone entry was discarded. Newer saved field entries can sync now.",
    );
    navigator.vibrate?.(10);
  };

  const enqueueOfflineActivity = useCallback(
    (entry: OfflinePulseEntry) => {
      const next = [...offlineQueueRef.current, entry];
      if (!commitOfflineQueue(next)) {
        setNotice(null);
        setError(
          "This phone could not store the field entry. It was not saved or synced.",
        );
        return false;
      }

      setUndoableActivity(null);
      setNotice(
        "Saved on this phone. It is waiting for a connection to reach HomeAtlas.",
      );
      navigator.vibrate?.(12);
      return true;
    },
    [commitOfflineQueue],
  );

  const recordActivity = async (
    activityType: ManualPulseActivity,
    source: "pulse" | "fixed-door" = "pulse",
  ) => {
    const clientEventId = crypto.randomUUID();
    const offlineEntry: OfflinePulseActivityEntry = {
      kind: "activity",
      activityType,
      clientEventId,
      createdAt: new Date().toISOString(),
    };

    if (activityType === "door_knock") {
      setDoorMemoryDraft({
        doorActivityClientEventId: clientEventId,
        clientEventId: crypto.randomUUID(),
        propertyAddress: "",
        disposition: null,
        notes: "",
      });
    }

    setActivityPending(activityType);
    if (!undoableActivity) setNotice(null);
    setError(null);
    if (!navigator.onLine) {
      const queued = enqueueOfflineActivity(offlineEntry);
      if (source === "fixed-door") {
        setFixedDoorFeedback({
          mode: queued ? "queued" : "error",
          message: queued
            ? "Door saved on this phone — not synced yet."
            : "Door was not saved. Open the field pulse for details.",
          clientEventId: queued ? clientEventId : undefined,
        });
      }
      setActivityPending(null);
      return;
    }

    let responseReceived = false;
    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(
      () => requestController.abort(),
      4_000,
    );
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          signal: requestController.signal,
          body: JSON.stringify({
            kind: "activity",
            activity: {
              activityType,
              quantity: 1,
              clientEventId,
              occurredAt: offlineEntry.createdAt,
            },
          }),
        },
      );
      responseReceived = true;
      const body = (await response.json().catch(() => null)) as ActivityMutationResponse | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not record activity.");
      setUndoableActivity(body?.activity ?? null);
      setNotice(body?.message ?? "Field activity recorded.");
      if (source === "fixed-door") {
        setFixedDoorFeedback({
          mode: "synced",
          message: "Door saved to HomeAtlas.",
          activity: body?.activity,
        });
      }
      navigator.vibrate?.(18);
      await loadWorkspace();
    } catch (activityError) {
      if (!responseReceived) {
        const queued = enqueueOfflineActivity(offlineEntry);
        if (source === "fixed-door") {
          setFixedDoorFeedback({
            mode: queued ? "queued" : "error",
            message: queued
              ? "Connection dropped. Door saved on this phone."
              : "Door was not saved. Open the field pulse for details.",
            clientEventId: queued ? clientEventId : undefined,
          });
        }
        return;
      }
      const message =
        activityError instanceof Error
          ? activityError.message
          : "Could not record activity.";
      setError(message);
      if (activityType === "door_knock") {
        setDoorMemoryDraft((current) =>
          current?.doorActivityClientEventId === clientEventId ? null : current,
        );
      }
      if (source === "fixed-door") {
        setFixedDoorFeedback({ mode: "error", message: "Door was not saved." });
      }
    } finally {
      window.clearTimeout(requestTimeout);
      setActivityPending(null);
    }
  };

  const openHomeownerFromDoor = (draft: DoorMemoryDraft) => {
    setLeadForm({
      ...EMPTY_LEAD_FORM,
      propertyAddress: draft.propertyAddress,
      nextFollowUpAt:
        draft.disposition === "follow_up" ? suggestedFollowUpValue(1) : "",
      notes: draft.notes,
      doorMemoryClientEventId: draft.clientEventId,
    });
    setLeadFormOpen(true);
  };

  const saveDoorMemory = async (
    intent: "move-on" | "add-homeowner",
  ) => {
    const draft = doorMemoryDraft;
    if (!draft?.disposition || doorMemorySaving) return;

    const entry: OfflineDoorMemoryEntry = {
      kind: "door_memory",
      clientEventId: draft.clientEventId,
      doorActivityClientEventId: draft.doorActivityClientEventId,
      propertyAddress: draft.propertyAddress,
      disposition: draft.disposition,
      notes: draft.notes,
      createdAt: new Date().toISOString(),
    };
    const finish = (mode: "queued" | "synced") => {
      const countsConversation = salesDoorDispositionCountsConversation(
        entry.disposition,
      );
      setDoorMemoryDraft(null);
      setUndoableActivity(null);
      setFixedDoorFeedback({
        mode,
        message:
          mode === "queued"
            ? countsConversation
              ? "Door outcome and one talk are safe on this phone."
              : "Door address and outcome are safe on this phone."
            : countsConversation
              ? "Door outcome saved and one talk counted."
              : "Door address and outcome are saved to HomeAtlas.",
        clientEventId:
          mode === "queued" ? draft.doorActivityClientEventId : undefined,
      });
      if (intent === "add-homeowner") openHomeownerFromDoor(draft);
    };

    setDoorMemorySaving(true);
    setError(null);
    const activityStillQueued = offlineQueueRef.current.some(
      (queued) =>
        queued.kind === "activity" &&
        queued.clientEventId === draft.doorActivityClientEventId,
    );
    if (!navigator.onLine || activityStillQueued) {
      const queued = enqueueOfflineActivity(entry);
      if (queued) finish("queued");
      setDoorMemorySaving(false);
      return;
    }

    let responseReceived = false;
    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(
      () => requestController.abort(),
      4_000,
    );
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          signal: requestController.signal,
          body: JSON.stringify({
            kind: "door_memory",
            memory: {
              doorActivityClientEventId: entry.doorActivityClientEventId,
              clientEventId: entry.clientEventId,
              propertyAddress: entry.propertyAddress,
              disposition: entry.disposition,
              notes: entry.notes,
            },
          }),
        },
      );
      responseReceived = true;
      const body = (await response.json().catch(() => null)) as
        | DoorMemoryMutationResponse
        | null;
      if (!response.ok || !body?.memory) {
        throw new Error(body?.error ?? "Could not save this door memory.");
      }
      setNotice(body.message ?? "Door address and outcome saved.");
      finish("synced");
      navigator.vibrate?.(18);
      await loadWorkspace();
    } catch (memoryError) {
      if (!responseReceived) {
        const queued = enqueueOfflineActivity(entry);
        if (queued) finish("queued");
        return;
      }
      setError(
        memoryError instanceof Error
          ? memoryError.message
          : "Could not save this door memory.",
      );
    } finally {
      window.clearTimeout(requestTimeout);
      setDoorMemorySaving(false);
    }
  };

  const syncOfflineQueue = useCallback(async () => {
    if (offlineSyncingRef.current || !navigator.onLine) return;

    const queued = offlineQueueRef.current;
    if (queued.length === 0) {
      offlineQueueRef.current = [];
      setOfflineQueue([]);
      setSyncError(null);
      return;
    }

    offlineSyncingRef.current = true;
    setOfflineSyncing(true);
    setSyncError(null);
    let syncedCount = 0;

    try {
      while (offlineQueueRef.current.length > 0 && navigator.onLine) {
        const entry = offlineQueueRef.current[0];
        const command =
          entry.kind === "activity"
            ? {
                kind: "activity" as const,
                activity: {
                  activityType: entry.activityType,
                  quantity: 1,
                  clientEventId: entry.clientEventId,
                  occurredAt: entry.createdAt,
                },
              }
            : {
                kind: "door_memory" as const,
                memory: {
                  doorActivityClientEventId:
                    entry.doorActivityClientEventId,
                  clientEventId: entry.clientEventId,
                  propertyAddress: entry.propertyAddress,
                  disposition: entry.disposition,
                  notes: entry.notes,
                },
              };
        const response = await fetch(
          `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
          {
            method: "POST",
            headers: getAdminRequestHeaders(),
            body: JSON.stringify(command),
          },
        );
        const body = (await response.json().catch(() => null)) as
          | ActivityMutationResponse
          | DoorMemoryMutationResponse
          | null;
        if (!response.ok) {
          setSyncError(
            body?.error ??
              `HomeAtlas could not sync the phone queue (${response.status}).`,
          );
          break;
        }

        const next = offlineQueueRef.current.filter(
          (candidate) => candidate.clientEventId !== entry.clientEventId,
        );
        if (!commitOfflineQueue(next)) {
          setSyncError(
            "HomeAtlas received an entry, but this phone could not update its queue. A safe idempotent retry is still available.",
          );
          break;
        }
        const activityBody =
          entry.kind === "activity"
            ? (body as ActivityMutationResponse | null)
            : null;
        const reversibleActivity = activityBody?.activity?.undoExpiresAt
          ? activityBody.activity
          : undefined;
        if (reversibleActivity) setUndoableActivity(reversibleActivity);
        setFixedDoorFeedback((current) =>
          entry.kind === "activity" &&
          current?.clientEventId === entry.clientEventId
            ? {
                mode: "synced",
                message: "Saved phone door is now synced to HomeAtlas.",
                activity: reversibleActivity,
              }
            : entry.kind === "door_memory" &&
                current?.clientEventId === entry.doorActivityClientEventId
              ? {
                  mode: "synced",
                  message: salesDoorDispositionCountsConversation(
                    entry.disposition,
                  )
                    ? "Door outcome synced and one talk counted."
                    : "Door address and outcome are now synced.",
                }
              : current,
        );
        syncedCount += 1;
      }

      if (syncedCount > 0) {
        await loadWorkspace();
        navigator.vibrate?.(18);
        const remainingCount = offlineQueueRef.current.length;
        setNotice(
          remainingCount === 0
            ? `${syncedCount} saved field ${syncedCount === 1 ? "entry is" : "entries are"} now synced to HomeAtlas.`
            : `${syncedCount} field ${syncedCount === 1 ? "entry" : "entries"} synced. ${remainingCount} still waiting on this phone.`,
        );
      }
    } catch {
      setSyncError(
        "The connection dropped during sync. Saved phone entries are still waiting and safe to retry.",
      );
    } finally {
      offlineSyncingRef.current = false;
      setOfflineSyncing(false);
    }
  }, [commitOfflineQueue, loadWorkspace, repSlug]);

  useEffect(() => {
    const queued = readOfflinePulseQueue(repSlug);
    offlineQueueRef.current = queued;
    const frame = window.requestAnimationFrame(() => {
      setOfflineQueue(queued);
      setIsOnline(navigator.onLine);
      if (queued.length > 0 && navigator.onLine) void syncOfflineQueue();
    });

    const handleOnline = () => {
      setIsOnline(true);
      void syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [repSlug, syncOfflineQueue]);

  const undoLastActivity = async (
    activity: SalesActivityReceipt | null = undoableActivity,
  ) => {
    if (!activity) return;

    const activityId = activity.id;
    setUndoPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ kind: "undo_activity", activityId }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not undo that activity.");
      setUndoableActivity((current) =>
        current?.id === activityId ? null : current,
      );
      setFixedDoorFeedback((current) =>
        current?.activity?.id === activityId ? null : current,
      );
      setNotice(body?.message ?? "Last activity undone. Today's total is corrected.");
      await loadWorkspace();
    } catch (undoError) {
      setError(
        undoError instanceof Error
          ? undoError.message
          : "Could not undo that activity.",
      );
    } finally {
      setUndoPending(false);
    }
  };

  const undoFixedDoorEntry = async () => {
    if (!fixedDoorFeedback) return;
    if (
      fixedDoorFeedback.mode === "queued" &&
      fixedDoorFeedback.clientEventId
    ) {
      if (!removeQueuedActivity(fixedDoorFeedback.clientEventId)) return;
      setNotice("The phone-only door entry was removed before syncing.");
      navigator.vibrate?.(10);
      return;
    }
    if (fixedDoorFeedback.mode === "synced" && fixedDoorFeedback.activity) {
      await undoLastActivity(fixedDoorFeedback.activity);
    }
  };

  const openLeadPresentation = async (
    leadId: string,
    options: { homeownerJustSaved?: boolean } = {},
  ): Promise<boolean> => {
    if (presentationOpeningLeadId) return false;

    setPresentationOpeningLeadId(leadId);
    setError(null);
    if (!options.homeownerJustSaved) setNotice(null);
    try {
      const response = await fetch("/api/presentations", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({ repSlug: profile.slug, salesRepLeadId: leadId }),
      });
      const body = (await response.json().catch(() => null)) as
        | PresentationMutationResponse
        | null;
      if (!response.ok || !body?.presentation?.id) {
        throw new Error(body?.error ?? "Could not open this homeowner’s plan.");
      }

      navigator.vibrate?.(18);
      router.push(
        presentationWorkspacePath(body.presentation, {
          returnTo: profile.workspacePath,
        }),
      );
      return true;
    } catch (presentationError) {
      if (options.homeownerJustSaved) {
        setNotice(
          "Homeowner saved. Their plan is safe to retry from the follow-up queue.",
        );
      }
      setError(
        presentationError instanceof Error
          ? presentationError.message
          : "HomeAtlas could not open the plan. Nothing was duplicated or sent.",
      );
      await loadWorkspace();
      return false;
    } finally {
      setPresentationOpeningLeadId(null);
    }
  };

  const saveLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const doorMemoryStillQueued = Boolean(
      leadForm.doorMemoryClientEventId &&
        offlineQueueRef.current.some(
          (entry) =>
            entry.kind === "door_memory" &&
            entry.clientEventId === leadForm.doorMemoryClientEventId,
        ),
    );
    if (doorMemoryStillQueued) {
      setError(
        "Sync the saved doorstep entry before creating this homeowner so their history stays linked.",
      );
      if (navigator.onLine) void syncOfflineQueue();
      return;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLElement
      | null;
    const saveIntent =
      submitter?.dataset.intent === "build-plan"
        ? "build-plan"
        : "follow-up";
    setLeadSaving(true);
    setLeadSaveIntent(saveIntent);
    setUndoableActivity(null);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ kind: "lead", lead: leadForm }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | LeadMutationResponse
        | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not save homeowner.");
      if (!body?.lead?.id) {
        setLeadForm(EMPTY_LEAD_FORM);
        setLeadFormOpen(false);
        setNotice(body?.message ?? "Homeowner saved for follow-up.");
        setError(
          "HomeAtlas saved the homeowner but could not open their plan from this response. Use their queue card instead of saving them again.",
        );
        await loadWorkspace();
        return;
      }
      setLeadForm(EMPTY_LEAD_FORM);
      setLeadFormOpen(false);
      if (saveIntent === "build-plan") {
        setNotice("Homeowner saved. Opening their Home Care Plan…");
        await openLeadPresentation(body.lead.id, { homeownerJustSaved: true });
        return;
      }
      setNotice(body.message ?? "Homeowner saved for follow-up.");
      await loadWorkspace();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save homeowner.",
      );
    } finally {
      setLeadSaving(false);
      setLeadSaveIntent(null);
    }
  };

  const openLeadActionEditor = (lead: SalesRepLead) => {
    const status: UpdateSalesLeadInput["status"] =
      lead.status === "follow_up" ||
      lead.status === "presentation" ||
      lead.status === "considering" ||
      lead.status === "lost"
        ? lead.status
        : "new";
    setEditingLeadId(lead.id);
    setLeadActionDraft({
      status,
      estimatedArrDollars: lead.estimatedArrCents / 100,
      nextFollowUpAt: localDateTimeInputValue(lead.nextFollowUpAt),
      notes: lead.notes,
    });
    setError(null);
  };

  const saveLeadAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingLeadId || !leadActionDraft) return;

    setLeadActionSaving(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/workspace`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({
            kind: "update_lead",
            lead: { leadId: editingLeadId, ...leadActionDraft },
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not save the next move.");
      }
      setEditingLeadId(null);
      setLeadActionDraft(null);
      setNotice(body?.message ?? "Next move saved.");
      await loadWorkspace();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the next move.",
      );
    } finally {
      setLeadActionSaving(false);
    }
  };

  const workspaceLeads = workspace?.leads ?? EMPTY_LEADS;
  const recentDoorMemories =
    workspace?.recentDoorMemories ?? EMPTY_DOOR_MEMORIES;
  const recentDoorMemoriesStatus =
    workspace?.recentDoorMemoriesStatus ?? "complete";
  const recentWins = workspace?.recentWins ?? EMPTY_RECENT_WINS;
  const recentWinsStatus = workspace?.recentWinsStatus ?? "complete";
  const productionHandoffStatus =
    workspace?.productionHandoffStatus ?? "complete";
  const closeLedgerStatus = workspace?.closeLedgerStatus ?? "complete";
  const workspaceGeneratedAt = workspace?.generatedAt ?? null;
  const leadDoorMemoryPending = Boolean(
    leadForm.doorMemoryClientEventId &&
      offlineQueue.some(
        (entry) =>
          entry.kind === "door_memory" &&
          entry.clientEventId === leadForm.doorMemoryClientEventId,
      ),
  );
  const returnedClose = closedPresentationId
    ? recentWins.find(
        (win) => win.presentationId === closedPresentationId,
      ) ?? null
    : null;
  const leadActionQueue = useMemo(
    () =>
      buildSalesLeadActionQueue(
        workspaceLeads,
        actionClock > 0
          ? new Date(actionClock)
          : workspaceGeneratedAt
            ? new Date(workspaceGeneratedAt)
            : new Date(),
      ),
    [actionClock, workspaceGeneratedAt, workspaceLeads],
  );
  const leadActionCounts = useMemo(
    () => summarizeSalesLeadActionQueue(leadActionQueue),
    [leadActionQueue],
  );
  const filteredLeadActionQueue = useMemo(
    () =>
      filterSalesLeadActionQueue(leadActionQueue, {
        filter: leadQueueFilter,
        query: leadSearchQuery,
      }),
    [leadActionQueue, leadQueueFilter, leadSearchQuery],
  );
  const leadQueueIsNarrowed =
    leadQueueFilter !== "all" || leadSearchQuery.trim().length > 0;
  const visibleLeadActionQueue =
    showAllLeads || leadQueueIsNarrowed
      ? filteredLeadActionQueue
      : filteredLeadActionQueue.slice(0, 8);
  const leadQueueFilters: Array<{
    filter: SalesLeadQueueFilter;
    label: string;
    count: number;
  }> = [
    { filter: "all", label: "All", count: leadActionQueue.length },
    {
      filter: "needs_action",
      label: "Needs action",
      count:
        leadActionCounts.overdue +
        leadActionCounts.due_today +
        leadActionCounts.unscheduled,
    },
    { filter: "overdue", label: "Overdue", count: leadActionCounts.overdue },
    {
      filter: "due_today",
      label: "Today",
      count: leadActionCounts.due_today,
    },
    {
      filter: "unscheduled",
      label: "No next move",
      count: leadActionCounts.unscheduled,
    },
    {
      filter: "upcoming",
      label: "Upcoming",
      count: leadActionCounts.upcoming,
    },
  ];

  return (
    <AmbientStage
      founding={!sunlightMode}
      warm={!sunlightMode}
      className={`pb-32 transition-colors duration-200 motion-reduce:transition-none ${
        sunlightMode
          ? "[--accent:#fde047] [--background:#000000] [--foreground:#ffffff] [--glass-bg:rgba(255,255,255,0.08)] [--glass-bg-elevated:rgba(255,255,255,0.1)] [--glass-bg-subtle:rgba(255,255,255,0.07)] [--glass-border:rgba(255,255,255,0.4)] [--glass-highlight:rgba(255,255,255,0.14)] [--muted:#e4e4e7] [--on-accent:#111111]"
          : ""
      }`}
    >
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
          sunlightMode
            ? "border-white/40 bg-black/95"
            : "border-white/[0.07] bg-[#090806]/88"
        }`}
      >
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-8">
          <Link
            href={profile.workspacePath}
            aria-label={`${profile.displayName}'s field desk home`}
            className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <AtlasMark size={36} />
            <div className="hidden sm:block">
              <p className="font-serif text-base font-light tracking-[0.08em] text-foreground">
                {`${profile.displayName}'s Field Desk`}
              </p>
              <p className="text-[9px] uppercase tracking-[0.24em] text-accent">
                HomeAtlas private
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSunlightMode}
              aria-pressed={sunlightMode}
              className={`min-h-11 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4 ${
                sunlightMode
                  ? "border-yellow-300 bg-yellow-300 text-black"
                  : "border-white/15 bg-white/[0.04] text-foreground"
              }`}
            >
              {sunlightMode ? "Sun on" : "Sun mode"}
            </button>
            {isStandalone ? (
              <span className="hidden rounded-full border border-emerald-300/30 bg-emerald-300/[0.08] px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-emerald-100 min-[380px]:inline-flex">
                Phone ready
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void installWorkspace()}
                className="min-h-11 rounded-full border border-accent/40 bg-accent/[0.1] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4"
              >
                Install
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-8 pt-4 sm:px-8 sm:pt-7">
        <section id="pulse" aria-labelledby="field-pulse-title">
          <div className="mb-4 flex flex-col items-start gap-2 px-1 min-[480px]:flex-row min-[480px]:items-end min-[480px]:justify-between min-[480px]:gap-4">
            <div>
              <p className={craftEyebrow}>One-hand field pulse</p>
              <h1
                id="field-pulse-title"
                className={`mt-1 text-3xl sm:text-4xl ${craftHeading}`}
              >
                Knock. Talk. Close. Move.
              </h1>
            </div>
            <p
              className={`shrink-0 text-left text-[10px] font-bold uppercase tracking-[0.12em] min-[480px]:text-right sm:text-xs ${
                totalsArePartial ? "text-amber-200" : "hidden text-muted sm:block"
              }`}
            >
              {totalsArePartial ? "Partial totals" : "Today · Pacific time"}
            </p>
          </div>

          {workspaceLoadError ? (
            <div
              className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-300/55 bg-amber-300/[0.11] px-4 py-3 text-amber-50 sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <div>
                <p className="text-sm font-bold">
                  {workspace ? "Partial field totals" : "Phone-only field totals"}
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-100/80">
                  {workspace
                    ? "HomeAtlas could not refresh. Totals combine the last loaded numbers with phone-only entries."
                    : "HomeAtlas could not load. Totals below include only entries saved on this phone."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadWorkspace()}
                className="min-h-11 shrink-0 rounded-full border border-amber-100/45 bg-black/20 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Retry totals
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const total =
                metrics[action.metric] + queuedPulseTotals[action.metric];
              const pending = activityPending === action.type;

              return (
                <button
                  key={action.type}
                  type="button"
                  disabled={
                    activityPending !== null ||
                    undoPending
                  }
                  onClick={() => void recordActivity(action.type)}
                  aria-label={`${action.detail}. ${totalsArePartial ? "Partial" : "Current"} total ${total}.`}
                  className={`group touch-manipulation select-none rounded-[1.5rem] border p-5 text-left shadow-[0_16px_42px_rgba(0,0,0,0.28)] transition-[transform,box-shadow,background-color] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.975] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-45 ${
                    action.wide
                      ? "col-span-2 min-h-[9.25rem] border-accent bg-accent text-[var(--on-accent)]"
                      : sunlightMode
                        ? "min-h-[8.75rem] border-white/80 bg-white text-black"
                        : "min-h-[8.75rem] border-white/20 bg-white/[0.08] text-foreground hover:bg-white/[0.12]"
                  }`}
                >
                  <span className="flex h-full flex-col justify-between gap-5">
                    <span className="flex items-start justify-between gap-4">
                      <span className="text-sm font-bold uppercase tracking-[0.13em]">
                        {action.label}
                      </span>
                      <span
                        className={`font-serif text-5xl leading-none tabular-nums ${
                          action.wide || sunlightMode
                            ? "text-current"
                            : "text-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {pending ? "..." : loading ? "--" : total}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span>{action.detail}</span>
                      <span aria-hidden="true" className="text-xl">
                        +1
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="rounded-[1.35rem] border border-emerald-300/35 bg-emerald-300/[0.09] px-5 py-4 text-emerald-50">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                    Signed memberships &middot; automatic
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-5">
                    Completed HomeAtlas agreements credit {profile.displayName} automatically.
                  </p>
                </div>
                <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto sm:gap-4 sm:text-right">
                  <div className="rounded-xl bg-black/15 px-3 py-2 sm:bg-transparent sm:p-0">
                    <p className="font-serif text-4xl tabular-nums">
                      {loading || (!workspace && totalsArePartial)
                        ? "--"
                        : metrics.signedToday}
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-emerald-200">
                      wins
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-black/15 px-3 py-2 sm:bg-transparent sm:p-0">
                    <p className="break-words font-serif text-2xl tabular-nums sm:text-3xl">
                      {loading || (!workspace && totalsArePartial)
                        ? "--"
                        : moneyFromCents(metrics.closedArrTodayCents)}
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-emerald-200">
                      closed ARR
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-emerald-100/75">
                No button to bump by accident. Finish the customer agreement and
                HomeAtlas records the win against the rep attribution.
              </p>
            </div>
            <Link
              href={`/presentations/new?rep=${encodeURIComponent(profile.slug)}`}
              className="inline-flex min-h-16 items-center justify-center rounded-[1.35rem] border border-accent/50 bg-accent/[0.1] px-6 text-center text-xs font-bold uppercase tracking-[0.14em] text-accent focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-w-48"
            >
              Start presentation
            </Link>
          </div>

          <p className="mt-3 px-1 text-[11px] font-medium leading-5 text-muted sm:text-xs">
            Next door starts each house. Saving Talked, Follow up, or Interested
            counts the talk automatically. Use Extra talk only away from a saved
            door. Presented saves separately; phone-only entries sync when service
            returns.
          </p>

          {offlineQueue.length > 0 ? (
            <div
              className="mt-4 flex flex-col gap-3 rounded-2xl border-2 border-amber-300/70 bg-amber-300/[0.13] px-4 py-4 text-amber-50 sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <div>
                <p className="text-sm font-bold">
                  {offlineQueue.length} field {offlineQueue.length === 1 ? "entry is" : "entries are"} saved on this phone.
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-100/80">
                  Not synced to HomeAtlas yet. Keep knocking; this device will retry
                  when the connection returns.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undoLastQueuedActivity}
                  disabled={offlineSyncing}
                  className="min-h-12 flex-1 rounded-full border border-amber-100/40 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none"
                >
                  Remove last
                </button>
                <button
                  type="button"
                  onClick={() => void syncOfflineQueue()}
                  disabled={offlineSyncing || !isOnline}
                  className="min-h-12 flex-1 rounded-full border border-amber-100/50 bg-black/25 px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none"
                >
                  {offlineSyncing ? "Syncing..." : "Retry sync"}
                </button>
              </div>
            </div>
          ) : null}

          {syncError ? (
            <div
              className="mt-3 flex flex-col gap-3 rounded-2xl border border-red-300/50 bg-red-300/[0.12] px-4 py-4 text-red-100 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <p className="text-sm leading-5">
                <span className="font-bold">Sync needs attention. </span>
                {syncError}
              </p>
              <div className="flex gap-2">
                {offlineQueue.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={discardOldestQueuedActivity}
                      disabled={offlineSyncing}
                      className="min-h-11 flex-1 rounded-full border border-red-100/35 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none"
                    >
                      Discard oldest
                    </button>
                    <button
                      type="button"
                      onClick={() => void syncOfflineQueue()}
                      disabled={offlineSyncing || !isOnline}
                      className="min-h-11 flex-1 rounded-full border border-red-100/45 bg-black/20 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none"
                    >
                      Retry
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSyncError(null)}
                  className="min-h-11 flex-1 rounded-full border border-red-100/30 px-4 text-[10px] font-bold uppercase tracking-[0.14em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-none"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-3" aria-live="polite">
            {notice ? (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-300/[0.12] px-4 py-4 text-sm font-medium text-emerald-50 sm:flex-row sm:items-center sm:justify-between"
                role="status"
              >
                <p>
                  <span className="mr-2 font-bold uppercase tracking-[0.12em]">
                    Saved.
                  </span>
                  {notice}
                </p>
                <div className="flex gap-2">
                  {undoableActivity ? (
                    <button
                      type="button"
                      onClick={() => void undoLastActivity()}
                      disabled={undoPending || activityPending !== null}
                      aria-label="Undo the last field pulse entry"
                      className="min-h-11 flex-1 rounded-full border border-emerald-100/50 bg-black/25 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none"
                    >
                      {undoPending ? "Undoing..." : "Undo"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearFeedback}
                    className="min-h-11 flex-1 rounded-full border border-emerald-100/30 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-none"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
            {error ? (
              <div
                className="flex items-center justify-between gap-3 rounded-2xl border border-red-300/50 bg-red-300/[0.12] px-4 py-4 text-sm font-medium text-red-100"
                role="alert"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={clearFeedback}
                  className="min-h-11 shrink-0 rounded-full border border-red-100/40 px-4 text-[10px] font-bold uppercase tracking-[0.14em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <DoorMemoryTimeline
          memories={recentDoorMemories}
          status={recentDoorMemoriesStatus}
          loading={loading}
        />

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <GlassCard tone="elevated" padding="lg" rim className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/[0.07] blur-3xl" aria-hidden />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
                  Field command · {profile.displayName}
                </p>
                {profile.isFoundingRep ? (
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-amber-200">
                    Founding rep
                  </span>
                ) : null}
              </div>
              <h2 className={`mt-5 max-w-3xl text-3xl sm:text-5xl ${craftHeading}`}>
                Turn every good doorstep into a remembered relationship.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted sm:text-base">
                Capture the homeowner, permission, next move, and value while the
                conversation is still fresh. HomeAtlas keeps the handoff visible.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setLeadFormOpen(true)}
                  className={craftPrimaryButton}
                >
                  Add homeowner
                </button>
                <Link
                  href={`/presentations/new?rep=${encodeURIComponent(profile.slug)}`}
                  className={craftSecondaryButton}
                >
                  Start presentation
                </Link>
              </div>
              {installHelp ? (
                <p className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-xs leading-5 text-foreground/75">
                  {installHelp}
                </p>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard tone="subtle" padding="lg">
            <div className="flex items-center justify-between gap-3">
              <p className={craftEyebrow}>Today in the field</p>
              {totalsArePartial ? (
                <span className="rounded-full border border-amber-300/35 bg-amber-300/[0.09] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-100">
                  Partial
                </span>
              ) : null}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Doors", metrics.doorsToday],
                ["Talks", metrics.conversationsToday],
                ["Pitches", metrics.presentationsToday],
                ["Auto signed", metrics.signedToday],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/[0.06] bg-black/15 p-4">
                  <p className="font-serif text-3xl tabular-nums text-foreground">
                    {loading || (!workspace && totalsArePartial) ? "–" : value}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-white/[0.07] pt-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted">Open pipeline</p>
                <p className="mt-1 font-serif text-2xl text-foreground">
                  {loading || (!workspace && totalsArePartial)
                    ? "–"
                    : moneyFromCents(metrics.pipelineArrCents)}
                </p>
              </div>
              <p className="text-xs text-muted">{metrics.openPipelineCount} people</p>
            </div>
          </GlassCard>
        </section>

        <section id="follow-ups" className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <GlassCard as="section" tone="default" padding="lg">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className={craftEyebrow}>Next-action queue</p>
                <h2 className={`mt-2 text-2xl sm:text-3xl ${craftHeading}`}>People worth remembering</h2>
                {leadActionQueue.length > 0 ? (
                  <p className="mt-2 text-[11px] leading-5 text-muted">
                    {leadActionCounts.overdue > 0
                      ? `${leadActionCounts.overdue} overdue`
                      : "Nothing overdue"}
                    {" · "}
                    {leadActionCounts.due_today} due today
                    {" · "}
                    {leadActionCounts.unscheduled} need a next move
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setLeadFormOpen(true)}
                className="min-h-11 text-xs uppercase tracking-[0.16em] text-accent"
              >
                + New
              </button>
            </div>

            {leadActionQueue.length > 0 ? (
              <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-5">
                <div>
                  <label htmlFor="sales-lead-search" className="sr-only">
                    Search open homeowners by name, address, phone, or email
                  </label>
                  <input
                    id="sales-lead-search"
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    value={leadSearchQuery}
                    onChange={(event) => {
                      setLeadSearchQuery(event.target.value);
                      setShowAllLeads(false);
                    }}
                    placeholder="Search name, address, phone, or email"
                    className={craftInput}
                  />
                </div>
                <div
                  className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  aria-label="Filter open homeowners by next action"
                >
                  {leadQueueFilters.map(({ filter, label, count }) => {
                    const active = leadQueueFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setLeadQueueFilter(filter);
                          setShowAllLeads(false);
                        }}
                        aria-pressed={active}
                        className={`min-h-11 shrink-0 rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.11em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                          active
                            ? "border-accent/45 bg-accent/[0.12] text-accent"
                            : "border-white/[0.09] bg-white/[0.025] text-muted"
                        }`}
                      >
                        {label} · {count}
                      </button>
                    );
                  })}
                </div>
                {leadQueueIsNarrowed ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted" aria-live="polite">
                      {filteredLeadActionQueue.length} of {leadActionQueue.length}{" "}
                      open {filteredLeadActionQueue.length === 1 ? "person" : "people"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setLeadSearchQuery("");
                        setLeadQueueFilter("all");
                        setShowAllLeads(false);
                      }}
                      className="min-h-11 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted">Loading private queue…</p>
              ) : leadActionQueue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-9 text-center">
                  <p className="font-serif text-xl text-foreground">Your first doorstep starts here.</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Add a homeowner and set the next check-in before leaving the driveway.
                  </p>
                </div>
              ) : filteredLeadActionQueue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-9 text-center">
                  <p className="font-serif text-xl text-foreground">No open people match.</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Try a different name or clear the urgency filter. The complete queue is still safe.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLeadSearchQuery("");
                      setLeadQueueFilter("all");
                      setShowAllLeads(false);
                    }}
                    className="mt-4 min-h-11 rounded-full border border-accent/35 bg-accent/[0.07] px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Show full queue
                  </button>
                </div>
              ) : (
                visibleLeadActionQueue.map(({ lead, moment }) => {
                  const phone = lead.phone?.replace(/[^\d+]/g, "") ?? "";
                  const canCall = phone.length > 0;
                  const canText =
                    canCall && lead.smsConsentStatus === "opted_in";
                  const canUseEmail =
                    Boolean(lead.email) &&
                    lead.emailConsentStatus === "opted_in";
                  const nextActionStyle = NEXT_ACTION_STYLES[moment];

                  return (
                    <article
                    key={lead.id}
                    className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 [contain-intrinsic-size:0_420px] [content-visibility:auto] sm:p-5"
                    >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-xl text-foreground">{lead.fullName}</h3>
                        <p className="mt-1 truncate text-xs text-muted">{lead.propertyAddress}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${nextActionStyle.className}`}>
                          {nextActionStyle.label}
                        </span>
                        <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-muted">
                          {statusLabel(lead.status)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                      <p className="text-xs text-foreground/70">{followUpLabel(lead.nextFollowUpAt)}</p>
                      <p className="text-xs tabular-nums text-accent">
                        {moneyFromCents(lead.estimatedArrCents)} est. ARR
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.14em]">
                      <span className={canCall ? "text-emerald-200" : "text-muted/60"}>
                        Call {canCall ? "ready" : "unavailable"}
                      </span>
                      <span className="text-muted/30">·</span>
                      <span className={lead.smsConsentStatus === "opted_in" ? "text-emerald-200" : "text-muted/60"}>
                        Text {lead.smsConsentStatus === "opted_in" ? "approved" : "not approved"}
                      </span>
                      <span className="text-muted/30">·</span>
                      <span className={lead.emailConsentStatus === "opted_in" ? "text-emerald-200" : "text-muted/60"}>
                        Email {lead.emailConsentStatus === "opted_in" ? "approved" : "not approved"}
                      </span>
                    </div>
                    {canCall || canUseEmail ? (
                      <div className="mt-4 flex flex-wrap gap-2" aria-label={`Contact ${lead.fullName}`}>
                        {canCall ? (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex min-h-11 min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-label={`Call ${lead.fullName}`}
                          >
                            Call
                          </a>
                        ) : null}
                        {canText ? (
                            <a
                              href={`sms:${phone}`}
                              className="inline-flex min-h-11 min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              aria-label={`Text ${lead.fullName}`}
                            >
                              Text
                            </a>
                        ) : null}
                        {canUseEmail ? (
                          <a
                            href={`mailto:${encodeURIComponent(lead.email ?? "")}`}
                            className="inline-flex min-h-11 min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-label={`Email ${lead.fullName}`}
                          >
                            Email
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-4 grid gap-2 min-[430px]:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void openLeadPresentation(lead.id)}
                        disabled={presentationOpeningLeadId !== null}
                        aria-label={`Build a Home Care Plan for ${lead.fullName}`}
                        className="inline-flex min-h-12 items-center justify-center rounded-full border border-accent/40 bg-accent/[0.08] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-accent disabled:cursor-wait disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {presentationOpeningLeadId === lead.id
                          ? "Opening plan…"
                          : "Build their plan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingLeadId === lead.id) {
                            setEditingLeadId(null);
                            setLeadActionDraft(null);
                            return;
                          }
                          openLeadActionEditor(lead);
                        }}
                        aria-expanded={editingLeadId === lead.id}
                        className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.035] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {editingLeadId === lead.id ? "Close next move" : "Update next move"}
                      </button>
                    </div>

                    {editingLeadId === lead.id && leadActionDraft ? (
                      <form
                        onSubmit={saveLeadAction}
                        className="mt-4 space-y-4 rounded-2xl border border-accent/20 bg-accent/[0.045] p-4"
                      >
                        <div>
                          <label htmlFor={`lead-status-${lead.id}`} className={craftLabel}>
                            Pipeline stage
                          </label>
                          <select
                            id={`lead-status-${lead.id}`}
                            value={leadActionDraft.status}
                            onChange={(event) => {
                              const status = event.target.value as LeadActionDraft["status"];
                              setLeadActionDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      status,
                                      nextFollowUpAt:
                                        status === "lost"
                                          ? ""
                                          : current.nextFollowUpAt,
                                    }
                                  : current,
                              );
                            }}
                            className={craftInput}
                          >
                            {LEAD_STAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor={`lead-arr-${lead.id}`} className={craftLabel}>
                            Estimated annual value
                          </label>
                          <input
                            id={`lead-arr-${lead.id}`}
                            type="number"
                            min="0"
                            step="50"
                            inputMode="decimal"
                            value={leadActionDraft.estimatedArrDollars}
                            onChange={(event) =>
                              setLeadActionDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      estimatedArrDollars: Number(event.target.value),
                                    }
                                  : current,
                              )
                            }
                            className={craftInput}
                          />
                        </div>

                        {leadActionDraft.status !== "lost" ? (
                          <div>
                            <label htmlFor={`lead-follow-up-${lead.id}`} className={craftLabel}>
                              Next action time
                            </label>
                            <input
                              id={`lead-follow-up-${lead.id}`}
                              type="datetime-local"
                              value={leadActionDraft.nextFollowUpAt}
                              onChange={(event) =>
                                setLeadActionDraft((current) =>
                                  current
                                    ? { ...current, nextFollowUpAt: event.target.value }
                                    : current,
                                )
                              }
                              className={craftInput}
                              required={
                                leadActionDraft.status === "follow_up" ||
                                leadActionDraft.status === "considering"
                              }
                            />
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {FOLLOW_UP_SHORTCUTS.map(({ days, label }) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() =>
                                    setLeadActionDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            status:
                                              current.status === "new"
                                                ? "follow_up"
                                                : current.status,
                                            nextFollowUpAt: suggestedFollowUpValue(
                                              days,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  className="min-h-10 rounded-xl border border-white/10 bg-black/15 px-2 text-[9px] font-bold uppercase tracking-[0.1em] text-muted"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <label htmlFor={`lead-notes-${lead.id}`} className={craftLabel}>
                            Latest context {leadActionDraft.status === "lost" ? "· reason required" : ""}
                          </label>
                          <textarea
                            id={`lead-notes-${lead.id}`}
                            rows={3}
                            value={leadActionDraft.notes}
                            onChange={(event) =>
                              setLeadActionDraft((current) =>
                                current
                                  ? { ...current, notes: event.target.value }
                                  : current,
                              )
                            }
                            className={craftTextarea}
                            placeholder="What was said, what matters, and what happens next?"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={leadActionSaving}
                          className="min-h-12 w-full rounded-full bg-accent px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--on-accent)] disabled:opacity-50"
                        >
                          {leadActionSaving ? "Saving next move…" : "Save next move"}
                        </button>
                      </form>
                    ) : null}
                    </article>
                  );
                })
              )}
              {!leadQueueIsNarrowed && leadActionQueue.length > 8 ? (
                <button
                  type="button"
                  onClick={() => setShowAllLeads((current) => !current)}
                  aria-expanded={showAllLeads}
                  className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted transition hover:border-accent/25 hover:text-accent"
                >
                  {showAllLeads
                    ? "Show highest-priority 8"
                    : `Show all ${leadActionQueue.length} open people`}
                </button>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard as="section" tone="subtle" padding="lg" className={profile.isFoundingRep ? "border-amber-300/15" : ""}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={craftEyebrow}>{profile.planLabel}</p>
                <h2 className={`mt-2 text-2xl ${craftHeading}`}>
                  {profile.isFoundingRep ? "David's career track" : "Commission profile"}
                </h2>
              </div>
              {profile.isFoundingRep ? (
                <span className="font-serif text-3xl text-amber-200">
                  {milestone.modeledEquityPercent}%
                </span>
              ) : null}
            </div>

            {profile.isFoundingRep ? (
              <>
                <p className="mt-4 text-sm leading-6 text-muted">
                  {metrics.qualifiedRetainedMembers} members have completed the 12-month
                  retention qualification. Draft modeling only—no payout or equity is
                  automatically granted here.
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/60 to-amber-200 transition-[width] duration-700"
                    style={{ width: `${milestone.progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                  {milestone.nextMilestone
                    ? `${milestone.nextMilestone.retainedMembers - metrics.qualifiedRetainedMembers} more retained members to model ${milestone.nextMilestone.modeledEquityPercent}%`
                    : "Top modeled milestone reached"}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted">
                This workspace includes standard sales tooling. Founder residual and
                equity modeling are not part of this representative&apos;s profile.
              </p>
            )}

            <div className="mt-6 space-y-3 border-t border-white/[0.07] pt-5">
              {profile.benefits.map((benefit) => (
                <div key={benefit.title}>
                  <p className="text-sm text-foreground/85">{benefit.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{benefit.detail}</p>
                </div>
              ))}
            </div>

            {profile.milestones.length > 0 ? (
              <div className="mt-6 grid grid-cols-5 gap-1.5" aria-label="David's modeled equity milestones">
                {profile.milestones.map((item) => (
                  <div
                    key={item.retainedMembers}
                    className={`rounded-xl border px-1 py-2 text-center ${
                      metrics.qualifiedRetainedMembers >= item.retainedMembers
                        ? "border-amber-200/30 bg-amber-200/[0.08] text-amber-100"
                        : "border-white/[0.06] text-muted/60"
                    }`}
                  >
                    <p className="font-serif text-base">{item.modeledEquityPercent}%</p>
                    <p className="mt-0.5 text-[8px] uppercase tracking-[0.1em]">{item.retainedMembers}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </GlassCard>
        </section>

        <section id="verified-closes" className="mt-8 scroll-mt-24">
          <GlassCard as="section" tone="elevated" padding="lg" rim>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={craftEyebrow}>Verified closes</p>
                <h2 className={`mt-2 text-2xl sm:text-3xl ${craftHeading}`}>
                  The wins HomeAtlas can prove
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  Only completed agreement signatures create these credits. Door taps
                  and manual pipeline changes never count as a close. Each card then
                  tracks the verified path from signature to scheduled production.
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] ${
                  closeLedgerStatus === "complete"
                    ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100"
                    : "border-amber-300/30 bg-amber-300/[0.08] text-amber-100"
                }`}
              >
                {closeLedgerStatus === "complete"
                  ? "Signature backed"
                  : "Sync review"}
              </span>
            </div>

            {closedPresentationId ? (
              loading ? (
                <div
                  className="mt-5 rounded-2xl border border-accent/25 bg-accent/[0.07] px-4 py-4 text-sm leading-6 text-foreground"
                  role="status"
                >
                  Verifying the completed field close against the signed membership
                  ledger…
                </div>
              ) : returnedClose ? (
                <div
                  className="mt-5 rounded-2xl border border-emerald-300/40 bg-emerald-300/[0.11] px-4 py-4 text-emerald-50 shadow-[0_18px_60px_rgba(52,211,153,0.08)]"
                  role="status"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                        Closed loop complete
                      </p>
                      <p className="mt-2 font-serif text-xl">
                        {returnedClose.fullName} is a verified signed membership.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-emerald-100/80">
                        The open lead left {profile.displayName}&apos;s queue
                        automatically. Card setup, Jobber pairing, and first-visit
                        readiness remain visible in the production handoff below.
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl border border-emerald-100/20 bg-black/15 px-4 py-3 sm:text-right">
                      <p className="font-serif text-2xl tabular-nums">
                        {moneyFromCents(returnedClose.attributedArrCents)}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                        verified ARR
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-5 rounded-2xl border border-amber-300/35 bg-amber-300/[0.08] px-4 py-4 text-sm leading-6 text-amber-50"
                  role="alert"
                >
                  HomeAtlas cannot verify this returned presentation as a signed
                  close yet, so no success credit is being shown. Refresh this desk
                  before relying on the close total.
                </div>
              )
            ) : null}

            {closeLedgerStatus === "needs_attention" ? (
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] px-4 py-4 text-sm leading-6 text-amber-50" role="alert">
                At least one recent signed membership still needs attribution repair,
                so the close total may be low. HomeAtlas did not create substitute or
                manual credit.
              </div>
            ) : null}

            {recentWinsStatus === "unavailable" ? (
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] px-4 py-4 text-sm leading-6 text-amber-50" role="status">
                Close totals are still verified, but HomeAtlas could not load the
                homeowner labels for this ledger. Refresh before relying on the names.
              </div>
            ) : productionHandoffStatus === "unavailable" ? (
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] px-4 py-4 text-sm leading-6 text-amber-50" role="status">
                Signed-close totals and names are verified, but the production handoff
                could not be read. Treat payment, pairing, and schedule status as
                unknown until this panel refreshes.
              </div>
            ) : loading ? (
              <p className="mt-6 py-6 text-center text-sm text-muted">
                Verifying signed memberships…
              </p>
            ) : recentWins.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/[0.1] px-5 py-8 text-center">
                <p className="font-serif text-xl text-foreground">
                  The first verified close will land here automatically.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  No manual signed counter is used, so an accidental field tap cannot
                  create a fake win.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recentWins.map((win) => {
                  const status = RECENT_WIN_STATUS[win.status];
                  const handoff = win.productionHandoff;
                  return (
                    <article
                      key={win.id}
                      className="rounded-2xl border border-white/[0.08] bg-black/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-serif text-xl text-foreground">
                            {win.fullName}
                          </h3>
                          <p className="mt-1 truncate text-xs text-muted">
                            {win.propertyAddress}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.07] pt-4">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.16em] text-muted">
                            Credited ARR
                          </p>
                          <p className="mt-1 font-serif text-2xl text-accent">
                            {moneyFromCents(win.attributedArrCents)}
                          </p>
                        </div>
                        <p className="pb-1 text-[10px] text-muted">
                          {recentWinDateLabel(win.attributedAt)}
                        </p>
                      </div>
                      {handoff ? (
                        <div className={`mt-4 rounded-xl border p-3 ${PRODUCTION_HANDOFF_STYLE[handoff.stage]}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em]">
                              Production handoff
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-[0.12em]">
                              {handoff.completedSteps}/{handoff.totalSteps}
                            </p>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20" aria-hidden="true">
                            <div
                              className="h-full rounded-full bg-current transition-[width]"
                              style={{
                                width: `${(handoff.completedSteps / handoff.totalSteps) * 100}%`,
                              }}
                            />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-current">
                            {handoff.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-current/80">
                            {handoff.detail}
                          </p>
                          {handoff.nextScheduledAt && handoff.stage === "ready" ? (
                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-current">
                              Next visit · {handoffVisitDateLabel(handoff.nextScheduledAt)}
                            </p>
                          ) : null}
                          <Link
                            href={handoff.actionHref}
                            className="mt-3 inline-flex min-h-10 items-center rounded-full border border-current/25 bg-black/10 px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-black/20"
                          >
                            {handoff.actionLabel} →
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/[0.07] p-3 text-amber-50">
                          <p className="text-[9px] font-bold uppercase tracking-[0.15em]">
                            Production handoff unverified
                          </p>
                          <p className="mt-2 text-[11px] leading-5 text-amber-50/80">
                            The signed credit remains valid. Refresh before relying on
                            payment, Jobber pairing, or schedule status.
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href={`/presentations/new?rep=${encodeURIComponent(profile.slug)}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
            <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Sell</p>
            <p className="mt-2 text-sm text-foreground">Open a HomeAtlas presentation →</p>
          </Link>
          {sessionKind === "sales_rep" ? (
            <a href="#follow-ups" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
              <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Follow up</p>
              <p className="mt-2 text-sm text-foreground">Open your next-action queue →</p>
            </a>
          ) : (
            <Link href="/hq/communications" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
              <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Follow up</p>
              <p className="mt-2 text-sm text-foreground">Open the shared customer inbox →</p>
            </Link>
          )}
          {sessionKind === "sales_rep" ? (
            <a href="#verified-closes" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
              <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Handoff</p>
              <p className="mt-2 text-sm text-foreground">See your verified closes →</p>
            </a>
          ) : (
            <Link href="/hq/memberships" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-accent/25">
              <p className="text-[9px] uppercase tracking-[0.2em] text-accent">Handoff</p>
              <p className="mt-2 text-sm text-foreground">See active memberships →</p>
            </Link>
          )}
        </section>
      </main>

      {fixedDoorFeedback ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] px-3 sm:px-6">
          <div
            className={`pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.48)] backdrop-blur-xl ${
              fixedDoorFeedback.mode === "error"
                ? "border-red-300/55 bg-[#2a0d0d]/95 text-red-50"
                : fixedDoorFeedback.mode === "queued"
                  ? "border-amber-300/60 bg-[#211b08]/95 text-amber-50"
                  : "border-emerald-300/55 bg-[#092017]/95 text-emerald-50"
            }`}
            role={fixedDoorFeedback.mode === "error" ? "alert" : "status"}
          >
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-80">
                {fixedDoorFeedback.mode === "queued"
                  ? "On this phone"
                  : fixedDoorFeedback.mode === "synced"
                    ? "HomeAtlas synced"
                    : "Not recorded"}
              </p>
              <p className="mt-1 text-sm font-semibold leading-5">
                {fixedDoorFeedback.message}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {(fixedDoorFeedback.mode === "queued" &&
                fixedDoorFeedback.clientEventId) ||
              (fixedDoorFeedback.mode === "synced" &&
                fixedDoorFeedback.activity) ? (
                <button
                  type="button"
                  onClick={() => void undoFixedDoorEntry()}
                  disabled={undoPending || offlineSyncing}
                  className="min-h-11 rounded-full border border-current/35 bg-black/20 px-4 text-[10px] font-bold uppercase tracking-[0.14em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
                >
                  Undo
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setFixedDoorFeedback(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-current/25 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Dismiss door confirmation"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className={`fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl ${
          sunlightMode
            ? "border-white/40 bg-black/95"
            : "border-white/[0.08] bg-[#090806]/92"
        }`}
        aria-label={`${profile.displayName}'s field desk`}
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 px-2">
          <button
            type="button"
            onClick={() => void recordActivity("door_knock", "fixed-door")}
            disabled={activityPending !== null || undoPending}
            className="my-1 flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl bg-accent text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--on-accent)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45"
            aria-label="Log the next door knock"
          >
            <span className="font-serif text-xl leading-none">+1</span> Door
          </button>
          <button type="button" onClick={() => setLeadFormOpen(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="font-serif text-lg">◎</span> Homeowner
          </button>
          <a href="#follow-ups" className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="font-serif text-lg">↗</span> Follow-ups
          </a>
          {sessionKind === "sales_rep" ? (
            <form action="/api/sales/access/logout" method="post">
              <button type="submit" className="flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <span className="font-serif text-lg">↪</span> Sign out
              </button>
            </form>
          ) : (
            <Link href="/hq" className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <span className="font-serif text-lg">⌂</span> HQ
            </Link>
          )}
        </div>
      </nav>

      {doorMemoryDraft ? (
        <DoorMemorySheet
          repSlug={repSlug}
          draft={doorMemoryDraft}
          recentMemories={recentDoorMemories}
          saving={doorMemorySaving}
          activityPending={activityPending === "door_knock"}
          onChange={setDoorMemoryDraft}
          onCancel={() => setDoorMemoryDraft(null)}
          onSave={(intent) => void saveDoorMemory(intent)}
        />
      ) : null}

      {leadFormOpen ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 px-3 py-4 backdrop-blur-md sm:px-6 sm:py-10">
          <div className="mx-auto max-w-2xl">
            <GlassCard tone="elevated" padding="lg" className="!bg-[#0d0b08]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={craftEyebrow}>Doorstep capture</p>
                  <h2 className={`mt-2 text-3xl ${craftHeading}`}>Remember this homeowner.</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setLeadFormOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] text-xl text-muted"
                  aria-label="Close homeowner form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={saveLead} className="mt-7 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sales-lead-name" className={craftLabel}>Homeowner name</label>
                    <input
                      id="sales-lead-name"
                      required
                      autoComplete="name"
                      value={leadForm.fullName}
                      onChange={(event) => setLeadForm((current) => ({ ...current, fullName: event.target.value }))}
                      className={craftInput}
                      placeholder="First and last name"
                    />
                  </div>
                  <div>
                    <label htmlFor="sales-lead-address" className={craftLabel}>Property address</label>
                    <input
                      id="sales-lead-address"
                      required
                      autoComplete="street-address"
                      value={leadForm.propertyAddress}
                      onChange={(event) => setLeadForm((current) => ({ ...current, propertyAddress: event.target.value }))}
                      className={craftInput}
                      placeholder="Street, city"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sales-lead-phone" className={craftLabel}>Mobile phone</label>
                    <input
                      id="sales-lead-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={leadForm.phone ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, phone: event.target.value }))}
                      className={craftInput}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label htmlFor="sales-lead-email" className={craftLabel}>Email</label>
                    <input
                      id="sales-lead-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={leadForm.email ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))}
                      className={craftInput}
                      placeholder="homeowner@email.com"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sales-lead-arr" className={craftLabel}>Estimated annual value</label>
                    <input
                      id="sales-lead-arr"
                      type="number"
                      min="0"
                      step="50"
                      inputMode="decimal"
                      value={leadForm.estimatedArrDollars ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, estimatedArrDollars: Number(event.target.value) }))}
                      className={craftInput}
                    />
                  </div>
                  <div>
                    <label htmlFor="sales-lead-follow-up" className={craftLabel}>Next check-in</label>
                    <input
                      id="sales-lead-follow-up"
                      type="datetime-local"
                      value={leadForm.nextFollowUpAt ?? ""}
                      onChange={(event) => setLeadForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))}
                      className={craftInput}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="sales-lead-notes" className={craftLabel}>Doorstep notes</label>
                  <textarea
                    id="sales-lead-notes"
                    rows={3}
                    value={leadForm.notes ?? ""}
                    onChange={(event) => setLeadForm((current) => ({ ...current, notes: event.target.value }))}
                    className={craftTextarea}
                    placeholder="What matters to them? What should the team remember?"
                  />
                </div>

                <fieldset className="space-y-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                  <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted">Customer permission</legend>
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 text-xs leading-5 text-foreground/75">
                    <input
                      type="checkbox"
                      checked={leadForm.smsConsentAttested === true}
                      onChange={(event) => setLeadForm((current) => ({ ...current, smsConsentAttested: event.target.checked }))}
                      className="mt-1 h-4 w-4 accent-[#c9b896]"
                    />
                    Customer gave SqueegeeKing permission to text this number about
                    this request and service follow-ups. Message/data rates may apply;
                    reply STOP to opt out.
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 text-xs leading-5 text-foreground/75">
                    <input
                      type="checkbox"
                      checked={leadForm.emailConsentAttested === true}
                      onChange={(event) => setLeadForm((current) => ({ ...current, emailConsentAttested: event.target.checked }))}
                      className="mt-1 h-4 w-4 accent-[#c9b896]"
                    />
                    Customer agreed to receive service and follow-up email about this request.
                  </label>
                  <p className="text-[10px] leading-4 text-muted/65">
                    Leave unchecked when permission was not explicit. Saving a check-in
                    does not automatically send a message.
                  </p>
                </fieldset>

                {leadDoorMemoryPending ? (
                  <p className="rounded-2xl border border-amber-300/35 bg-amber-300/[0.08] px-4 py-3 text-sm leading-5 text-amber-50" role="status">
                    The doorstep entry is safe on this phone. HomeAtlas will enable
                    homeowner save as soon as it syncs.
                  </p>
                ) : null}

                {error ? <p className="text-sm text-red-200" role="alert">{error}</p> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setLeadFormOpen(false)} className={craftSecondaryButton}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-intent="follow-up"
                    disabled={
                      leadSaving ||
                      presentationOpeningLeadId !== null ||
                      leadDoorMemoryPending
                    }
                    className={craftSecondaryButton}
                  >
                    {leadSaving && leadSaveIntent === "follow-up"
                      ? "Saving…"
                      : "Save for follow-up"}
                  </button>
                  <button
                    type="submit"
                    data-intent="build-plan"
                    disabled={
                      leadSaving ||
                      presentationOpeningLeadId !== null ||
                      leadDoorMemoryPending
                    }
                    className={craftPrimaryButton}
                  >
                    {leadSaving && leadSaveIntent === "build-plan"
                      ? "Building…"
                      : "Save & build plan"}
                  </button>
                </div>
                <p className="text-center text-[10px] leading-4 text-muted/65 sm:text-right">
                  Building a plan opens pricing immediately. Neither option contacts
                  or charges the customer.
                </p>
              </form>
            </GlassCard>
          </div>
        </div>
      ) : null}
    </AmbientStage>
  );
}
