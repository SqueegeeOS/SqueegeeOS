import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const repository = read("./packet-token-repository.ts");
const publicStatus = read("./public-status.ts");
const publicSigning = read("./public-signing.ts");
const signatureRoute = read(
  "../../app/api/enrollment/[token]/native-signature/route.ts",
);
const sendPacket = read("./send-packet.ts");
const stripeHandoff = read("./stripe-handoff.ts");

describe("durable enrollment links", () => {
  it("accepts the current digest first and then an unexpired historical digest", () => {
    const current = repository.indexOf('.from("enrollment_packets")');
    const historical = repository.indexOf(
      '.from("enrollment_packet_access_tokens")',
    );
    expect(current).toBeGreaterThan(-1);
    expect(historical).toBeGreaterThan(current);
    expect(repository).toContain('.is("revoked_at", null)');
    expect(repository).toContain('.gt("expires_at", new Date().toISOString())');
  });

  it("uses the shared lookup for every public agreement action", () => {
    expect(publicStatus).toContain("findEnrollmentPacketByToken(token)");
    expect(publicSigning).toContain("findEnrollmentPacketByToken(token)");
    expect(signatureRoute).toContain("findEnrollmentPacketByToken(token)");
  });

  it("records each agreement and payment-handoff token before sending", () => {
    expect(sendPacket).toContain("rememberEnrollmentPacketAccessToken({");
    expect(stripeHandoff).toContain("rememberEnrollmentPacketAccessToken({");
  });
});
