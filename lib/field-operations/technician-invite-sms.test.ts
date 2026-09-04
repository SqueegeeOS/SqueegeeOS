import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), config: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/admin/server-auth", () => ({ authorizeAdminRequest: mocks.auth }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: mocks.db }));
vi.mock("@/lib/communications/providers/twilio-sms", () => ({ getTwilioSmsConfigState: mocks.config, sendTwilioSms: mocks.send }));
import { POST } from "@/app/api/admin/technicians/access-grants/[grantId]/sms/route";
const id = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(43);
let attempted: string | null;
let reserved: boolean;
let grantExists: boolean;
const filters: unknown[][] = [];
const updates: unknown[] = [];
const request = () => POST(new Request("https://www.squeegeeking.net/api/admin/technicians/access-grants/" + id + "/sms", {
  method: "POST", body: JSON.stringify({ inviteToken: token, to: "+12025550999", body: "injected content" }),
}), { params: Promise.resolve({ grantId: id }) });
describe("private technician invite text", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("VERCEL_ENV", "production"); attempted = null; reserved = true; grantExists = true; filters.length = 0; updates.length = 0;
    mocks.auth.mockReturnValue(true); mocks.config.mockReturnValue({ configured: true });
    mocks.send.mockResolvedValue({ ok: true, status: "queued", providerMessageId: "SM-test" });
    mocks.db.mockReturnValue({ from: (table: string) => {
      let updating = false;
      const q = {
        select: () => q, eq: (...args: unknown[]) => { filters.push(args); return q; }, gt: (...args: unknown[]) => { filters.push(args); return q; },
        is: (...args: unknown[]) => { filters.push(args); return q; }, update: (value: unknown) => { updating = true; updates.push(value); return q; },
        maybeSingle: async () => ({ error: null, data: table === "homeatlas_technicians" ? { display_name: "Internal Test", phone_e164: "+12025550199" } : updating ? reserved ? { id } : null : grantExists ? {
          id, jobber_user_id: "homeatlas:" + id, display_name: "Internal Test", sms_attempted_at: attempted, sms_delivery_status: "queued", sms_provider_message_id: "SM-existing",
        } : null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      }; return q;
    } });
  });
  it("requires owner auth before any read or send", async () => {
    mocks.auth.mockReturnValue(false); expect((await request()).status).toBe(401); expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("never sends in preview or without configuration", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); expect((await request()).status).toBe(409);
    vi.stubEnv("VERCEL_ENV", "production"); mocks.config.mockReturnValue({ configured: false }); expect((await request()).status).toBe(503); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("sends only the fixed invitation to the registered phone after atomic reservation", async () => {
    const response = await request(); const body = await response.json();
    expect(response.status).toBe(200); expect(body).toMatchObject({ status: "queued", destinationEnding: "0199", receiptSaved: true });
    expect(mocks.send).toHaveBeenCalledWith({ to: "+12025550199", body: expect.stringContaining("https://www.squeegeeking.net/tech/access?token=" + token) });
    expect(mocks.send.mock.calls[0][0].body).not.toContain("injected content");
    expect(filters).toContainEqual(["sms_attempted_at", null]); expect(filters).toContainEqual(["status", "pending"]);
    expect(filters.find(row => row[0] === "invite_token_hash")?.[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(updates[0]).toMatchObject({ sms_delivery_status: "sending" });
    expect(JSON.stringify(body)).not.toContain(token);
  });
  it("does not resend a previous attempt or a lost reservation race", async () => {
    attempted = new Date().toISOString(); expect((await (await request()).json()).duplicate).toBe(true);
    attempted = null; reserved = false; expect((await (await request()).json()).duplicate).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects unavailable grants without sending", async () => {
    grantExists = false; expect((await request()).status).toBe(409); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("records uncertainty after a network failure and never retries", async () => {
    mocks.send.mockResolvedValue({ ok: false, errorCode: "network_error" });
    expect((await request()).status).toBe(502); expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(updates[1]).toMatchObject({ sms_delivery_status: "unknown" });
  });
});
