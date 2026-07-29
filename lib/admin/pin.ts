import {
  ADMIN_SESSION_TTL_MS,
  ADMIN_UNLOCK_KEY,
} from "./config";
import { clearHeadquartersBootFlag } from "@/lib/motion/boot-sequence";

interface AdminUnlockRecord {
  unlockedAt: number;
  mode: "pin" | "beta";
}

export function markAdminUnlocked(mode: "pin" | "beta"): void {
  if (typeof window === "undefined") return;

  const record: AdminUnlockRecord = {
    unlockedAt: Date.now(),
    mode,
  };

  sessionStorage.setItem(ADMIN_UNLOCK_KEY, JSON.stringify(record));
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
  void fetch("/api/admin/unlock", { method: "DELETE", keepalive: true }).catch(
    () => {},
  );
  clearHeadquartersBootFlag();
}

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;

  const raw = sessionStorage.getItem(ADMIN_UNLOCK_KEY);
  if (!raw) return false;

  try {
    const record = JSON.parse(raw) as AdminUnlockRecord;
    if (Date.now() - record.unlockedAt > ADMIN_SESSION_TTL_MS) {
      clearAdminSession();
      return false;
    }
    return true;
  } catch {
    clearAdminSession();
    return false;
  }
}
