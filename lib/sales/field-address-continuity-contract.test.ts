import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const addressInput = read(
  "../../components/address/field-property-address-input.tsx",
);
const doorMemory = read("../../components/sales/door-memory.tsx");
const fieldWorkspace = read(
  "../../components/sales/sales-rep-workspace.tsx",
);
const addressRoute = read(
  "../../app/api/admin/address-autocomplete/route.ts",
);
const presentationRoute = read("../../app/api/presentations/route.ts");

describe("field property identity continuity", () => {
  it("uses one reusable address picker at the door and in homeowner capture", () => {
    expect(doorMemory).toContain("FieldPropertyAddressInput");
    expect(doorMemory).toContain('id="door-memory-address"');
    expect(fieldWorkspace).toContain("FieldPropertyAddressInput");
    expect(fieldWorkspace).toContain('id="sales-lead-address"');
    expect(fieldWorkspace).toContain(
      "propertyAddress: draft.propertyAddress",
    );
  });

  it("keeps Google credentials server-only and allows either HQ or the rep pass", () => {
    expect(addressRoute).toContain("authorizeSalesRequest(request.headers)");
    expect(addressRoute).toContain("process.env.GOOGLE_MAPS_API_KEY");
    expect(addressInput).toContain(
      'fetch("/api/admin/address-autocomplete"',
    );
    expect(addressInput).not.toContain("places.googleapis.com");
    expect(addressInput).not.toContain("GOOGLE_MAPS_API_KEY");
  });

  it("falls back to editable manual capture without creating side effects", () => {
    expect(addressInput).toContain("Manual entry still works");
    expect(addressInput).toContain("Offline—type the address manually");
    expect(addressInput).toContain("Powered by Google");
    expect(addressInput).not.toContain("twilio");
    expect(addressInput).not.toContain("resend");
    expect(addressInput).not.toContain("stripe");
    expect(addressInput).not.toContain("POST /api/leads");
  });

  it("carries the server-owned field identity into one presentation", () => {
    expect(presentationRoute).toContain("lineage?.lead?.propertyAddress");
    expect(presentationRoute).toContain(
      "findAuthoritativePresentationForSalesLead",
    );
    expect(presentationRoute).toContain("const racedPresentation");
  });
});
