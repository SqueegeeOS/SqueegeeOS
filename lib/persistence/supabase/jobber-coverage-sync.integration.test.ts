import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DISPOSABLE_ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";
const configured =
  process.env.PR2_JOBBER_DISPOSABLE_DB_ACK === DISPOSABLE_ACK &&
  Boolean(process.env.PR2_JOBBER_TEST_DATABASE_URL);
const integration = configured ? describe : describe.skip;
const rehearsal = readFileSync(
  new URL("./tests/038_jobber_schedule_coverage_sync.sql", import.meta.url),
  "utf8",
).replace(/^\\set ON_ERROR_STOP on\s*/m, "");

integration("migration 038 disposable SQL rehearsal", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.PR2_JOBBER_TEST_DATABASE_URL,
      max: 1,
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("proves RLS, immutability, lock, CAS, stable finalize, stale rejection, and rollback", async () => {
    await expect(pool.query(rehearsal)).resolves.toBeDefined();
  });
});
