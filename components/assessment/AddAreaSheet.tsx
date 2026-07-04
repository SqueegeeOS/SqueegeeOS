"use client";

import {
  ADDON_AREAS,
  type AssessmentAreaKey,
  type AssessmentCategory,
} from "@/lib/health/assessment-areas";

interface AddAreaSheetProps {
  currentAreas: AssessmentAreaKey[];
  onAdd: (key: AssessmentAreaKey) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  windows: "Windows",
  roof: "Roof & Gutters",
  concrete: "Concrete & Hardscape",
  solar: "Solar Panels",
  exterior: "Exterior & Structure",
  landscape: "Landscape & Irrigation",
  custom: "Custom",
};

const CATEGORY_ORDER: AssessmentCategory[] = [
  "roof",
  "concrete",
  "solar",
  "exterior",
  "landscape",
  "custom",
];

export function AddAreaSheet({
  currentAreas,
  onAdd,
  onClose,
}: AddAreaSheetProps) {
  const available = ADDON_AREAS.filter((a) => !currentAreas.includes(a.key));

  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const items = available.filter((a) => a.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {} as Partial<Record<AssessmentCategory, typeof ADDON_AREAS>>,
  );

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70"
        onClick={onClose}
        aria-hidden
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[75vh] max-w-lg overflow-y-auto rounded-t-2xl bg-[#0f0f0f]">
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#2a2a2a]" />
        </div>

        <div className="px-5 py-4">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-serif text-base text-white">
              Add Assessment Area
            </h3>
            <button type="button" onClick={onClose} className="text-sm text-[#444]">
              Done
            </button>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <p className="py-8 text-center text-sm text-[#333]">
              All available areas have been added.
            </p>
          ) : (
            <div className="space-y-6 pb-8">
              {CATEGORY_ORDER.map((cat) => {
                const items = grouped[cat];
                if (!items?.length) return null;
                return (
                  <div key={cat}>
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-[#444]">
                      {CATEGORY_LABELS[cat]}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((area) => (
                        <button
                          key={area.key}
                          type="button"
                          onClick={() => onAdd(area.key)}
                          className="flex w-full items-center gap-3 rounded-xl bg-[#141414] px-4 py-3 text-left transition-colors hover:bg-[#1a1a1a] active:scale-[0.98]"
                        >
                          <span className="text-xl">{area.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-[#ccc]">{area.label}</p>
                            <p className="text-[10px] text-[#333]">
                              {area.description}
                            </p>
                          </div>
                          <span className="text-lg text-[#c9a96e]">+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-widest text-[#c9a96e]">
                  Custom Care Plan
                </p>
                <div className="rounded-xl border border-[#c9a96e18] bg-[#141414] px-4 py-4">
                  <p className="mb-1 text-sm text-[#ccc]">
                    Full Custom Care Assessment
                  </p>
                  <p className="mb-3 text-[10px] text-[#444]">
                    Adds all available assessment areas with NA support.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      available.forEach((a) => onAdd(a.key));
                      onClose();
                    }}
                    className="rounded-lg border border-[#c9a96e33] px-3 py-1.5 text-xs text-[#c9a96e]"
                  >
                    Add All Areas
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
