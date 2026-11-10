import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../persistence/supabase/migrations/20261110200806_safe_native_enrollment_revision.sql");
const route = read("../../app/api/admin/enrollment-packets/route.ts");
const signature = read("../../app/api/enrollment/[token]/native-signature/route.ts");
const send = read("./send-packet.ts");
describe("unsigned native revision safety contract", () => {
  it("requires an explicit HQ action and expected revision identity", () => {
    expect(route).toContain('body.action === "revise_unsigned_native"');
    expect(route).toContain('revising && actor.kind !== "admin"');
    expect(route).toContain("expectedTokenSha256");
    expect(route).toContain("revisionId");
  });
  it("returns JSON objects rather than ambiguous PostgREST composite arrays", () => {
    expect(migration.match(/returns jsonb/g)).toHaveLength(2);
    expect(migration).toContain("return to_jsonb(revised)");
    expect(migration).toContain("return to_jsonb(packet)");
  });
  it("locks before checking unsigned eligibility and archives before replacing", () => {
    expect(migration).toContain("where id = p_packet_id for update");
    expect(migration).toContain("prior.native_signature_started_at is not null");
    expect(migration).toContain("prior.signed_agreement_id is not null");
    expect(migration).toContain("from public.signed_agreements where presentation_id = prior.presentation_id");
    expect(migration.indexOf("'priorPacket', to_jsonb(prior)")).toBeLessThan(migration.indexOf("document_snapshot = p_values"));
    expect(migration).toContain("set revoked_at = now()");
    expect(migration).toContain("security invoker set search_path = ''");
    expect(migration.match(/from public, anon, authenticated/g)).toHaveLength(3);
  });
  it("claims signing before side effects and validates the actual bearer token under lock", () => {
    expect(signature.indexOf('supabase.rpc("claim_native_enrollment_signature"')).toBeLessThan(signature.indexOf("const completed = await completeRemoteEnrollmentSignature"));
    expect(signature).toContain("p_presented_token_sha256: enrollmentTokenSha256(token)");
    expect(migration).toContain("revoked_at is null and expires_at > now()");
    expect(migration).toContain("packet.public_token_sha256 is distinct from p_expected_token_sha256");
  });
  it("does not automatically resend a pending/uncertain revision or overwrite started signatures", () => {
    expect(send).toContain("!input.revision && packet?.revision_id");
    expect(send).toContain("packet?.native_signature_started_at");
    expect(send).toContain('.is("revision_id", null)');
    expect(send).toContain('.is("native_signature_started_at", null)');
    expect(migration).toContain("'revision:' || p_revision_id::text");
  });
});
