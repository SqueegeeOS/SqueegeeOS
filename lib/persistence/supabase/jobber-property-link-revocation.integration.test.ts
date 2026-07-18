import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";
const configured =
  process.env.JOBBER_J1_DISPOSABLE_DB_ACK === ACK &&
  Boolean(process.env.JOBBER_J1_TEST_DATABASE_URL);
const integration = configured ? describe : describe.skip;
const catalogRehearsal = readFileSync(
  new URL("./tests/041_jobber_property_link_revocation.sql", import.meta.url),
  "utf8",
).replace(/^\\set ON_ERROR_STOP on\s*/m, "");
const functionalRehearsal = readFileSync(
  new URL("./tests/039_jobber_visit_classification.sql", import.meta.url),
  "utf8",
).replace(/^\\set ON_ERROR_STOP on\s*/m, "");

integration("migration 041 disposable SQL rehearsal", () => {
  let pool: Pool;
  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.JOBBER_J1_TEST_DATABASE_URL,
      max: 1,
    });
  });
  afterAll(async () => pool?.end());

  it("invokes revocation against seeded authority and proves replay, failures, demotion, ledgers, and forbidden domains", async () => {
    await expect(pool.query(functionalRehearsal)).resolves.toBeDefined();
  });

  it("proves exact RPC ACL, replay evidence, RLS, and rollback-safe shape", async () => {
    await expect(pool.query(catalogRehearsal)).resolves.toBeDefined();
  });
});
