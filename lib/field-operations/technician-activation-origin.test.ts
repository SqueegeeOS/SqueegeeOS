import { beforeEach, describe, expect, it, vi } from "vitest";
import config from "../../next.config";

const { claim } = vi.hoisted(() => ({ claim: vi.fn() }));
vi.mock("@/lib/field-operations/field-access", () => ({
  claimTechnicianFieldPass: claim,
  FIELD_SESSION_COOKIE_NAME: "homeatlas_field_session",
}));
import { POST } from "../../app/api/field/access/claim/route";

function request(origin: string) {
  return new Request("https://www.squeegeeking.net/api/field/access/claim", {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams({ token: "a".repeat(43), returnTo: "/tech" }),
  });
}

describe("technician activation origin", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("overrides no-referrer only for activation without leaking the token URL", async () => {
    const rules = await config.headers!();
    const privateRule = rules.find(r => r.source === "/tech/:path*")!;
    const activation = rules.find(r => r.source === "/tech/access")!;
    expect(rules.indexOf(activation)).toBeGreaterThan(rules.indexOf(privateRule));
    expect(activation.headers).toContainEqual({ key: "Referrer-Policy", value: "strict-origin" });
    expect(privateRule.headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
  });

  it("claims same-origin form submissions and sets a private session cookie", async () => {
    claim.mockResolvedValue({ sessionToken: "b".repeat(43), actor: { sessionExpiresAt: "2027-09-04T00:00:00Z" } });
    const response = await POST(request("https://www.squeegeeking.net"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://www.squeegeeking.net/tech");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(claim).toHaveBeenCalledOnce();
  });

  it.each(["null", "https://attacker.example"])("still rejects %s before consuming invitations", async origin => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect((await POST(request(origin))).status).toBe(403);
      expect(claim).not.toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });

  it("returns an actionable failure page for an invalid token", async () => {
    claim.mockRejectedValue(new Error("Invalid test token"));
    const response = await POST(request("https://www.squeegeeking.net"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://www.squeegeeking.net/tech/access?error=claim-failed");
  });
});
