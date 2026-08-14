"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getServerAdminUnlockSnapshot,
  isAdminUnlocked,
  subscribeAdminUnlockChange,
} from "./pin";

/**
 * Keeps the server render and first client render locked, then adopts the
 * browser session immediately after hydration. The local override preserves
 * the existing gate callback contract while the external-store subscription
 * keeps multiple HQ surfaces in sync.
 */
export function useAdminUnlockedState() {
  const storedUnlocked = useSyncExternalStore(
    subscribeAdminUnlockChange,
    isAdminUnlocked,
    getServerAdminUnlockSnapshot,
  );
  const [locallyUnlocked, setLocallyUnlocked] = useState(false);

  return [storedUnlocked || locallyUnlocked, setLocallyUnlocked] as const;
}
