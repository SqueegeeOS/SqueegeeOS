import { beforeEach, describe, expect, it, vi } from "vitest";
import { fieldAssignmentPhotoStoragePrefix } from "./visit-field-record";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), from: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/admin/server-auth", () => ({ authorizeAdminRequest: mocks.authorize }));
vi.mock("@/lib/persistence/supabase/client", () => ({ createServiceRoleSupabaseClient: mocks.client }));
import { GET } from "@/app/api/admin/field-records/[assignmentId]/route";

const assignmentId = "11111111-1111-4111-8111-111111111111";
const fieldRecordId = "22222222-2222-4222-8222-222222222222";
const prefix = fieldAssignmentPhotoStoragePrefix({ fieldAssignmentId: assignmentId, fieldRecordId });
const record = { field_record_id: fieldRecordId, technician_display_name: "Tyler Germany", visit_date: "2026-09-04",
  created_at: "2026-09-04T20:00:00Z", customer_summary: "Cleaned exterior glass.", internal_note: "Latch needs owner attention.",
  scope_exception: "", follow_up_needed: true };
let recordResult: { data: typeof record | null; error: unknown };
let photoResult: { data: Array<{ id: string; storage_path: string; capture_type: string; mime_type: string }>; error: unknown };
const eq = vi.fn();
function request(id = assignmentId) {
  return GET(new Request(`https://www.squeegeeking.net/api/admin/field-records/${id}`), { params: Promise.resolve({ assignmentId: id }) });
}

describe("owner-only native closeout evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockReturnValue(true);
    recordResult = { data: record, error: null };
    photoResult = { data: [{ id: "photo-1", storage_path: `${prefix}33333333-3333-4333-8333-333333333333.jpg`, capture_type: "after", mime_type: "image/jpeg" }], error: null };
    mocks.sign.mockResolvedValue({ data: { signedUrl: "https://storage.example/signed-photo" }, error: null });
    mocks.from.mockImplementation((table: string) => {
      const query = { select: vi.fn().mockReturnThis(), eq: eq.mockReturnThis(), maybeSingle: async () => recordResult, order: async () => photoResult };
      expect(["homeatlas_technician_job_closeouts", "homeatlas_technician_job_photos"]).toContain(table);
      return query;
    });
    mocks.client.mockReturnValue({ from: mocks.from, storage: { from: () => ({ createSignedUrl: mocks.sign }) } });
  });
  it("requires owner authorization before reading any data", async () => {
    mocks.authorize.mockReturnValue(false);
    expect((await request()).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rejects malformed targets without querying", async () => {
    expect((await request("../another")).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("loads only the selected closeout and signs its own photos for five minutes", async () => {
    const response = await request();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(eq).toHaveBeenCalledWith("assignment_id", assignmentId);
    expect(eq).toHaveBeenCalledWith("field_record_id", fieldRecordId);
    expect(mocks.sign).toHaveBeenCalledWith(photoResult.data[0].storage_path, 300);
    expect(body).toMatchObject({ technicianName: "Tyler Germany", internalNote: record.internal_note, followUpNeeded: true });
    expect(body.photos[0]).not.toHaveProperty("storage_path");
  });
  it("never signs cross-assignment paths or traversal", async () => {
    photoResult.data[0].storage_path = `${prefix}../other.jpg`;
    expect((await (await request()).json()).photos[0].url).toBeNull();
    photoResult.data[0].storage_path = "other-closeout/3333.jpg";
    expect((await (await request()).json()).photos[0].url).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("keeps notes readable when storage cannot sign a photo", async () => {
    mocks.sign.mockResolvedValue({ error: { message: "Storage unavailable" }, data: null });
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).photos[0].url).toBeNull();
  });
  it("returns explicit empty and unavailable states without database error leakage", async () => {
    recordResult.data = null;
    expect((await request()).status).toBe(404);
    recordResult.error = { message: "secret connection detail" };
    const response = await request();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret connection detail");
  });
});
