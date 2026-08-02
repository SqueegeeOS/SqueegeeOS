import type { AtlasPulseIntegration } from "./atlas-pulse-types";

const FULL_SYNC_FRESHNESS_MS = 24 * 60 * 60 * 1000;

export type GoogleOwnerConnectionState =
  | "connected"
  | "refresh_required"
  | "disconnected"
  | "error"
  | "not_connected"
  | "unavailable";

export interface GoogleReviewsHealthInput {
  oauthConfigured: boolean;
  tokenEncryptionReady: boolean;
  ownerConnectionState: GoogleOwnerConnectionState;
  durablePlaceId: string | null;
  envPlaceId: string | null;
  mapsApiKeyConfigured: boolean;
  lastFullSyncAt: string | null;
  lastFullReviewCount: number | null;
  lastErrorCode: string | null;
  publicFullReviewsEnabled: boolean;
  now?: number;
}

function ownerStateLabel(state: GoogleOwnerConnectionState): string {
  switch (state) {
    case "connected":
      return "connected";
    case "refresh_required":
      return "reauthorization required";
    case "disconnected":
      return "disconnected";
    case "error":
      return "connection error";
    case "unavailable":
      return "state unavailable";
    default:
      return "not connected";
  }
}

function syncState(input: GoogleReviewsHealthInput): {
  current: boolean;
  label: string;
} {
  if (input.ownerConnectionState !== "connected") {
    return { current: false, label: "not available" };
  }
  if (input.lastErrorCode) {
    return { current: false, label: `attention (${input.lastErrorCode})` };
  }

  const lastSyncTime = input.lastFullSyncAt
    ? Date.parse(input.lastFullSyncAt)
    : Number.NaN;
  if (!Number.isFinite(lastSyncTime)) {
    return { current: false, label: "pending" };
  }

  const age = (input.now ?? Date.now()) - lastSyncTime;
  if (age < 0 || age > FULL_SYNC_FRESHNESS_MS) {
    return { current: false, label: "stale" };
  }

  const count = input.lastFullReviewCount;
  return {
    current: true,
    label: count === null ? "current" : `current (${count} reviews)`,
  };
}

export function buildGoogleReviewsHealth(
  input: GoogleReviewsHealthInput,
): Pick<AtlasPulseIntegration, "status" | "message" | "detail"> {
  const configReady = input.oauthConfigured && input.tokenEncryptionReady;
  const ownerConnected = input.ownerConnectionState === "connected";
  const sync = syncState(input);
  const hasActiveDurableSelection =
    input.ownerConnectionState === "connected" ||
    input.ownerConnectionState === "refresh_required" ||
    input.ownerConnectionState === "error";
  const publicPlaceId = hasActiveDurableSelection
    ? input.durablePlaceId
    : input.envPlaceId;
  const publicSource =
    input.publicFullReviewsEnabled && ownerConnected && sync.current
      ? "full owner review archive"
      : input.mapsApiKeyConfigured && publicPlaceId
        ? "Google Maps preview"
        : "unavailable";
  const placeIdMismatch = Boolean(
    hasActiveDurableSelection &&
      input.durablePlaceId &&
      input.durablePlaceId !== input.envPlaceId,
  );

  const detailParts = [
    `Config: ${configReady ? "ready" : "incomplete"}`,
    `Owner: ${ownerStateLabel(input.ownerConnectionState)}`,
    `Sync: ${sync.label}`,
    `Public source: ${publicSource}`,
  ];
  if (placeIdMismatch) {
    detailParts.push(
      `Place ID blocker: selected ${input.durablePlaceId}; GOOGLE_PLACE_ID ${input.envPlaceId ?? "missing"}. JSON-LD uses GOOGLE_PLACE_ID.`,
    );
  }

  if (publicSource === "unavailable") {
    return {
      status: "offline",
      message: ownerConnected
        ? "Owner connected, but public Google reviews are unavailable"
        : "Google reviews are not available on the public site",
      detail: detailParts.join(" · "),
    };
  }

  if (placeIdMismatch) {
    return {
      status: "attention",
      message: `Place ID mismatch blocks healthy status · public: ${publicSource}`,
      detail: detailParts.join(" · "),
    };
  }

  if (!configReady) {
    return {
      status: "attention",
      message: `OAuth configuration incomplete · public: ${publicSource}`,
      detail: detailParts.join(" · "),
    };
  }

  if (!ownerConnected) {
    return {
      status: "attention",
      message: `Owner profile ${ownerStateLabel(input.ownerConnectionState)} · public: ${publicSource}`,
      detail: detailParts.join(" · "),
    };
  }

  if (!sync.current) {
    return {
      status: "attention",
      message: `Owner connected · sync ${sync.label} · public: ${publicSource}`,
      detail: detailParts.join(" · "),
    };
  }

  return {
    status: "healthy",
    message: `Owner connected · sync current · public: ${publicSource}`,
    detail: detailParts.join(" · "),
  };
}
