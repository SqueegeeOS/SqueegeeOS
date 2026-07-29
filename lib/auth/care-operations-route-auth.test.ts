import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  loadPreview: vi.fn(),
}));

vi.mock("@/lib/auth/hq-route-authorization", () => ({
  authorizeHqApiRequest: mocks.authorize,
}));
vi.mock("@/lib/care-operations/monthly-preview", () => ({
  loadMonthlyBillingPreview: mocks.loadPreview,
}));

import { GET } from "../../app/api/admin/care-operations/billing-preview/route";

describe("Care Operations route authorization behavior", () => {
  beforeEach(() => {
    mocks.authorize.mockReset();
    mocks.loadPreview.mockReset();
  });

  it.each([401, 403, 503])(
    "returns the authorization boundary's %i response before domain work",
    async (status) => {
      mocks.authorize.mockResolvedValue({
        response: NextResponse.json(
          { error: "boundary" },
          { status },
        ),
      });

      const response = await GET(
        new Request(
          "https://homeatlas.example/api/admin/care-operations/billing-preview?month=2026-07",
        ),
      );

      expect(response.status).toBe(status);
      expect(mocks.loadPreview).not.toHaveBeenCalled();
    },
  );
});
