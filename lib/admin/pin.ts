import {
  ADMIN_PIN_SESSION_KEY,
  ADMIN_SESSION_TTL_MS,
  ADMIN_UNLOCK_KEY,
  isAdminPrivateBeta,
} from "./config";

interface AdminUnlockRecord {
  unlockedAt: number;
  mode: "pin" | "beta";
}

export function verifyAdminPin(pin: string): boolean {
  const configured = process.env.NEXT_PUBLIC_ADMIN_PIN?.trim();
  if (!configured) return true;
  return pin === configured;
}

export function markAdminUnlocked(mode: "pin" | "beta", pin?: string): void {
  if (typeof window === "undefined") return;

  const record: AdminUnlockRecord = {
    unlockedAt: Date.now(),
    mode,
  };

  sessionStorage.setItem(ADMIN_UNLOCK_KEY, JSON.stringify(record));
  if (pin && mode === "pin") {
    sessionStorage.setItem(ADMIN_PIN_SESSION_KEY, pin);
  }
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
  sessionStorage.removeItem(ADMIN_PIN_SESSION_KEY);
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

export function getAdminPinForApi(): string | null {
  if (typeof window === "undefined") return null;
  if (isAdminPrivateBeta()) return null;
  return sessionStorage.getItem(ADMIN_PIN_SESSION_KEY);
}

export function authorizeAdminRequest(pinHeader: string | null): boolean {
  const configured = process.env.NEXT_PUBLIC_ADMIN_PIN?.trim();
  if (!configured) return true;
  return pinHeader === configured;
}
