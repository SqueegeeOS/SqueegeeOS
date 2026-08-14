import { describe, expect, it } from "vitest";
import {
  clearVisitFieldDraft,
  readVisitFieldDraft,
  type VisitFieldDraft,
  VISIT_FIELD_DRAFT_TTL_MS,
  visitFieldDraftStorageKey,
  writeVisitFieldDraft,
} from "@/lib/field-records/visit-field-draft";

const NOW = Date.UTC(2026, 7, 14, 19, 0, 0);
const scope = {
  propertyId: "11111111-1111-4111-8111-111111111111",
  appointmentId: "22222222-2222-4222-8222-222222222222",
};

function validDraft(
  overrides: Partial<VisitFieldDraft> = {},
): VisitFieldDraft {
  return {
    version: 1,
    ...scope,
    fieldRecordId: "33333333-3333-4333-8333-333333333333",
    technicianName: "Donovan",
    visitDate: "2026-08-14",
    customerSummary: "Exterior glass is clean and ready for the homeowner.",
    internalNote: "Back gate sticks near the latch.",
    followUpNeeded: true,
    selectedPhotoCount: 3,
    savedAt: NOW,
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("visit field draft", () => {
  it("round-trips one scoped field draft", () => {
    const storage = memoryStorage();
    const draft = validDraft();

    expect(writeVisitFieldDraft(storage, draft, NOW)).toBe(true);
    expect(readVisitFieldDraft(storage, scope, NOW)).toEqual(draft);
    expect(clearVisitFieldDraft(storage, scope)).toBe(true);
    expect(readVisitFieldDraft(storage, scope, NOW)).toBeNull();
  });

  it("rejects and removes a draft copied into another appointment scope", () => {
    const storage = memoryStorage();
    const otherScope = {
      ...scope,
      appointmentId: "44444444-4444-4444-8444-444444444444",
    };
    storage.setItem(
      visitFieldDraftStorageKey(otherScope),
      JSON.stringify(validDraft()),
    );

    expect(readVisitFieldDraft(storage, otherScope, NOW)).toBeNull();
    expect(storage.getItem(visitFieldDraftStorageKey(otherScope))).toBeNull();
  });

  it("rejects and removes a draft after 72 hours", () => {
    const storage = memoryStorage();
    const draft = validDraft();
    expect(writeVisitFieldDraft(storage, draft, NOW)).toBe(true);

    expect(
      readVisitFieldDraft(storage, scope, NOW + VISIT_FIELD_DRAFT_TTL_MS + 1),
    ).toBeNull();
    expect(storage.getItem(visitFieldDraftStorageKey(scope))).toBeNull();
  });

  it("rejects oversized text and impossible photo counts", () => {
    const storage = memoryStorage();

    expect(
      writeVisitFieldDraft(
        storage,
        validDraft({ customerSummary: "x".repeat(1_201) }),
        NOW,
      ),
    ).toBe(false);
    expect(
      writeVisitFieldDraft(
        storage,
        validDraft({ internalNote: " ".repeat(2_501) }),
        NOW,
      ),
    ).toBe(false);
    expect(
      writeVisitFieldDraft(storage, validDraft({ selectedPhotoCount: 9 }), NOW),
    ).toBe(false);
    expect(storage.getItem(visitFieldDraftStorageKey(scope))).toBeNull();
  });

  it("fails softly when a device denies local storage", () => {
    const deniedStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };

    expect(readVisitFieldDraft(deniedStorage, scope, NOW)).toBeNull();
    expect(writeVisitFieldDraft(deniedStorage, validDraft(), NOW)).toBe(false);
    expect(clearVisitFieldDraft(deniedStorage, scope)).toBe(false);
  });
});
