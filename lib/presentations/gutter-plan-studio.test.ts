// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { PresentationPlanStudio } from "@/components/presentations/presentation-plan-studio";
import { createDefaultPresentation } from "./repository";
import { createPresentationDraftPayload, restorePresentationDraftPayload } from "./draft-persistence";
import type { PresentationData } from "./types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("gutter membership service editor", () => {
  it("selects, reselects, saves, and reopens gutter scope without changing exact prices", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let presentation = createDefaultPresentation({ tier: "biannual" });
    presentation.planMode = "custom";
    presentation.carePlan.visits = presentation.carePlan.visits.map((visit) => ({ ...visit, priceOverride: 714 }));
    function render() {
      root.render(createElement(PresentationPlanStudio, { presentation, onChange: (patch: Partial<PresentationData>) => { presentation = { ...presentation, ...patch }; render(); } }));
    }
    try {
      await act(async () => { render(); });
      function gutterPolicy() {
        const card = [...container.querySelectorAll("article")].find((element) => element.querySelector("p")?.textContent === "Gutter cleaning");
        expect(card).toBeDefined();
        return card!.querySelector("select")!;
      }
      async function selectPolicy(value: string) {
        await act(async () => { const select = gutterPolicy(); select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
      }
      expect(gutterPolicy().value).toBe("not_offered");
      await selectPolicy("always_included");
      expect(presentation.carePlan.visits.map((visit) => visit.gutterCleaning)).toEqual(["included", "included"]);
      expect(container.textContent).toContain("gutters every visit");
      expect(container.textContent).toContain("$1,428/yr");
      await selectPolicy("optional_add_on");
      expect(presentation.carePlan.visits.every((visit) => visit.gutterCleaning === "optional")).toBe(true);
      await selectPolicy("selected_visits");
      expect(presentation.carePlan.visits.map((visit) => visit.gutterCleaning)).toEqual(["included", "not_included"]);
      await selectPolicy("always_included");
      await selectPolicy("always_included");
      const saved = JSON.parse(JSON.stringify(createPresentationDraftPayload(presentation)));
      presentation = restorePresentationDraftPayload(createDefaultPresentation({ tier: "biannual" }), saved);
      await act(async () => { render(); });
      expect(gutterPolicy().value).toBe("always_included");
      expect(presentation.carePlan.visits.map((visit) => visit.priceOverride)).toEqual([714, 714]);
      const gutterVisitSelects = [...container.querySelectorAll("label")].filter((label) => label.querySelector("span")?.textContent === "Gutter cleaning").map((label) => label.querySelector("select")!);
      expect(gutterVisitSelects).toHaveLength(2);
      await act(async () => { gutterVisitSelects[1]!.value = "not_included"; gutterVisitSelects[1]!.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(gutterPolicy().value).toBe("selected_visits");
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });
});
