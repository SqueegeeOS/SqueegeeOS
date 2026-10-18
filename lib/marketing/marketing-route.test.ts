import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), snapshot: vi.fn(), status: vi.fn(), reviewUrl: vi.fn() }));
vi.mock("@/lib/admin/server-auth", () => ({ authorizeAdminRequest: mocks.authorize }));
vi.mock("@/lib/aftercare/customer-aftercare-server", () => ({ loadCustomerAftercareSnapshot: mocks.snapshot }));
vi.mock("@/lib/aftercare/review-request-automation-server", () => ({ loadReviewRequestAutomationStatus: mocks.status }));
vi.mock("@/lib/reviews/review-request-url-server", () => ({ resolveGoogleReviewRequestUrl: mocks.reviewUrl }));
import { GET } from "@/app/api/admin/marketing/route";

describe("private marketing context", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authorize.mockReturnValue(true);
    mocks.snapshot.mockResolvedValue({ tasks: [{ type: "review_opportunity", appointmentId: "visit-1", serviceLabel: "Window Cleaning", completedAt: "2026-10-17T12:00:00Z", homeownerName: "PRIVATE NAME", propertyLabel: "123 Private Street", portalToken: "PRIVATE TOKEN" }, { type: "annual_care_checkin", homeownerName: "OTHER PRIVATE NAME" }] });
    mocks.status.mockResolvedValue({ state: "off", detail: "Not enabled" });
    mocks.reviewUrl.mockResolvedValue("https://g.page/r/example/review");
  });
  it("rejects unauthorized requests before reading customer data", async () => {
    mocks.authorize.mockReturnValue(false);
    const response = await GET(new Request("https://example.com/api/admin/marketing"));
    expect(response.status).toBe(401);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("exposes only the minimum visit reference and disables caching", async () => {
    const response = await GET(new Request("https://example.com/api/admin/marketing"));
    const data = await response.json();
    expect(data.visits).toEqual([{ id: "visit-1", serviceLabel: "Window Cleaning", completedAt: "2026-10-17T12:00:00Z" }]);
    expect(JSON.stringify(data)).not.toContain("PRIVATE");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("keeps readiness available when visit storage is unavailable", async () => {
    mocks.snapshot.mockRejectedValue(new Error("storage unavailable"));
    const response = await GET(new Request("https://example.com/api/admin/marketing"));
    expect(await response.json()).toMatchObject({ visitsAvailable: false, visits: [], reviewAutomation: { state: "off" } });
  });
  it("does not echo private free-text details embedded in a service label", async () => {
    mocks.snapshot.mockResolvedValue({ tasks: [{ type: "review_opportunity", appointmentId: "visit-2", serviceLabel: "Windows for PRIVATE NAME at 123 Private Street", completedAt: "2026-10-17T12:00:00Z" }] });
    const response = await GET(new Request("https://example.com/api/admin/marketing"));
    const data = await response.json();
    expect(data.visits[0].serviceLabel).toBe("Window Cleaning");
    expect(JSON.stringify(data)).not.toContain("PRIVATE");
    expect(JSON.stringify(data)).not.toContain("Street");
  });
});
