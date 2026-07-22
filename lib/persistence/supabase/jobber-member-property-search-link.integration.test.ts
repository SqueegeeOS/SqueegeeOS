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
    "./tests/040_jobber_member_property_search_link.sql",
    import.meta.url,
  ),
);

integration("migration 040 disposable member-property link rehearsal", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.JOBBER_J1_TEST_DATABASE_URL,
      max: 1,
    });
  });

  afterAll(async () => pool?.end());

  it("invokes the RPC and proves replay, fail-closed, ACL/RLS, immutability, and forbidden-domain contracts", async () => {
    await expect(pool.query(rehearsal)).resolves.toBeDefined();
  }, 120_000);
});
