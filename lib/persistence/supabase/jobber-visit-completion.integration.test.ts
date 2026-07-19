import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";
const configured =
  process.env.JOBBER_J1_DISPOSABLE_DB_ACK === ACK &&
  Boolean(process.env.JOBBER_J1_TEST_DATABASE_URL);
const integration = configured ? describe : describe.skip;
const rehearsal = readFileSync(
  new URL(
    "./tests/043_authoritative_visit_completion_evidence.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/^\\set ON_ERROR_STOP on\s*/m, "");

integration("migration 043 disposable authoritative-completion rehearsal", () => {
  let pool: Pool;
  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.JOBBER_J1_TEST_DATABASE_URL,
      max: 1,
    });
  });
  afterAll(async () => pool?.end());

  it("proves completion/evidence ACL, failure, replay, immutability, and forbidden-domain contracts", async () => {
    await expect(pool.query(rehearsal)).resolves.toBeDefined();
  }, 120_000);
});
