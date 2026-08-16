import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  resolveOnboardingSafe,
  resolveSignedPdfAccessCheck,
  selectSignedAgreementProbeFile,
  tiersDisagree,
  worstStatus,
} from "@/lib/admin/production-health-server";
import type { ProductionHealthSection } from "@/lib/admin/production-health-types";

describe("worstStatus", () => {
  it("returns the most severe status", () => {
    expect(worstStatus(["green", "yellow", "red"])).toBe("red");
    expect(worstStatus(["green", "yellow"])).toBe("yellow");
    expect(worstStatus(["green", "green"])).toBe("green");
  });
});

describe("tiersDisagree", () => {
  it("flags presentation or agreement tier mismatches", () => {
    expect(
      tiersDisagree("biannual", "quarterly", "SqueegeeKing Bi-Annual Home Care Membership"),
    ).toBe(true);
    expect(
      tiersDisagree(
        "biannual",
        "biannual",
        "SqueegeeKing Bi-Annual Home Care Membership",
      ),
    ).toBe(false);
  });
});

describe("resolveOnboardingSafe", () => {
  const greenSection = (id: string, title: string): ProductionHealthSection => ({
    id,
    title,
    status: "green",
    checks: [],
  });

  it("blocks onboarding when schema is red", () => {
    const result = resolveOnboardingSafe([
      { id: "schema", title: "Database", status: "red", checks: [] },
      greenSection("stripe", "Stripe"),
    ]);
    expect(result.status).toBe("red");
    expect(result.summary).toContain("Do not onboard");
  });

  it("blocks onboarding when customer privacy is red", () => {
    const result = resolveOnboardingSafe([
      greenSection("schema", "Database"),
      greenSection("stripe", "Stripe"),
      { id: "privacy", title: "Customer data privacy", status: "red", checks: [] },
    ]);
    expect(result.status).toBe("red");
    expect(result.summary).toContain("customer data privacy is not closed");
  });

  it("requires manual review for yellow-only issues", () => {
    const result = resolveOnboardingSafe([
      greenSection("schema", "Database"),
      { id: "stripe", title: "Stripe", status: "yellow", checks: [] },
    ]);
    expect(result.status).toBe("yellow");
    expect(result.summary).toContain("Manual review");
  });

  it("is green when all sections are green", () => {
    const result = resolveOnboardingSafe([
      greenSection("schema", "Database"),
      greenSection("stripe", "Stripe"),
    ]);
    expect(result.status).toBe("green");
  });

  it("keeps optional integration setup separate from onboarding safety", () => {
    const result = resolveOnboardingSafe([
      greenSection("schema", "Database"),
      greenSection("stripe", "Stripe"),
      {
        id: "integrations",
        title: "Integrations & automation",
        status: "red",
        checks: [],
      },
    ]);

    expect(result.status).toBe("green");
    expect(result.summary).toContain("ready for live customer onboarding");
  });
});

describe("selectSignedAgreementProbeFile", () => {
  it("selects a real PDF object and ignores folders or other file types", () => {
    expect(
      selectSignedAgreementProbeFile([
        { id: null, name: "customer-folder" },
        { id: "image-object", name: "signature.png" },
        { id: "agreement-object", name: "signed-agreement.PDF" },
      ]),
    ).toEqual({ id: "agreement-object", name: "signed-agreement.PDF" });
  });

  it("returns null when no stored PDF can be tested", () => {
    expect(
      selectSignedAgreementProbeFile([
        { id: null, name: "customer-folder" },
        { id: "image-object", name: "signature.png" },
      ]),
    ).toBeNull();
  });
});

describe("resolveSignedPdfAccessCheck", () => {
  it("is green only when an existing stored PDF can be signed", () => {
    expect(
      resolveSignedPdfAccessCheck({
        bucketExists: true,
        serviceRole: true,
        probeState: "found",
        signedUrlWorks: true,
      }),
    ).toMatchObject({
      status: "green",
      message:
        "An existing private agreement PDF produced a short-lived signed URL",
    });
  });

  it("is yellow when the bucket is healthy but has no PDF to test yet", () => {
    expect(
      resolveSignedPdfAccessCheck({
        bucketExists: true,
        serviceRole: true,
        probeState: "empty",
        signedUrlWorks: false,
      }),
    ).toMatchObject({
      status: "yellow",
      message: "No stored agreement PDF is available to test yet",
    });
  });

  it("is red when stored PDFs cannot be inspected", () => {
    expect(
      resolveSignedPdfAccessCheck({
        bucketExists: true,
        serviceRole: true,
        probeState: "failed",
        signedUrlWorks: false,
        detail: "storage unavailable",
      }),
    ).toMatchObject({
      status: "red",
      message: "Stored agreement PDFs could not be inspected",
      detail: "storage unavailable",
    });
  });

  it("is red when an existing PDF cannot produce a signed URL", () => {
    expect(
      resolveSignedPdfAccessCheck({
        bucketExists: true,
        serviceRole: true,
        probeState: "found",
        signedUrlWorks: false,
      }),
    ).toMatchObject({
      status: "red",
      message: "An existing agreement PDF could not produce a signed URL",
    });
  });
});

describe("production health storage and schema wiring", () => {
  it("probes the real provider key and a stored PDF instead of a fake object", () => {
    const source = readFileSync(
      new URL("./production-health-server.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain('column: "provider"');
    expect(source).toContain(
      '.from(SIGNED_AGREEMENT_BUCKET).list("", {',
    );
    expect(source).not.toContain(".production-health-probe.pdf");
  });
});
