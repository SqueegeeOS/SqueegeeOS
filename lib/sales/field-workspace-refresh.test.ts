import { describe, expect, it } from "vitest";
import {
  FIELD_WORKSPACE_REFRESH_INTERVAL_MS,
  fieldWorkspaceSyncLabel,
  shouldAutoRefreshFieldWorkspace,
} from "./field-workspace-refresh";

describe("field workspace refresh policy", () => {
  it("polls only while the phone is online and visible", () => {
    expect(
      shouldAutoRefreshFieldWorkspace({
        isOnline: true,
        visibilityState: "visible",
      }),
    ).toBe(true);
    expect(
      shouldAutoRefreshFieldWorkspace({
        isOnline: false,
        visibilityState: "visible",
      }),
    ).toBe(false);
    expect(
      shouldAutoRefreshFieldWorkspace({
        isOnline: true,
        visibilityState: "hidden",
      }),
    ).toBe(false);
    expect(FIELD_WORKSPACE_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("describes server-backed freshness without inventing a timestamp", () => {
    const reference = new Date("2026-08-16T18:00:00.000Z");
    expect(fieldWorkspaceSyncLabel(null, reference)).toBe("Sync pending");
    expect(
      fieldWorkspaceSyncLabel("2026-08-16T17:59:30.000Z", reference),
    ).toBe("Synced just now");
    expect(
      fieldWorkspaceSyncLabel("2026-08-16T17:52:00.000Z", reference),
    ).toBe("Synced 8m ago");
    expect(
      fieldWorkspaceSyncLabel("2026-08-16T15:30:00.000Z", reference),
    ).toBe("Synced 2h ago");
    expect(fieldWorkspaceSyncLabel("not-a-date", reference)).toBe(
      "Sync time unavailable",
    );
  });
});
