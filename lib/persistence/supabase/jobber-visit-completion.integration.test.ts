import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isAcknowledgedDisposableJobberDatabase,
  loadPsqlRehearsal,
} from "./tests/support/disposable-postgres";

const integration = isAcknowledgedDisposableJobberDatabase()
  ? describe
  : describe.skip;
const rehearsal = loadPsqlRehearsal(
  new URL(
    "./tests/043_authoritative_visit_completion_evidence.sql",
    import.meta.url,
  ),
);

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
