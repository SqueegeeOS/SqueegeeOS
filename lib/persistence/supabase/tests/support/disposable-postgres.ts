import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";

export const JOBBER_DISPOSABLE_DATABASE_ACK =
  "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";

const fingerprintUtilityUrl = new URL(
  "./forbidden_domain_fingerprints.sql",
  import.meta.url,
);

export function loadPsqlRehearsal(sourceUrl: URL): string {
  const source = readFileSync(sourceUrl, "utf8").replace(
    /^\\set\s+ON_ERROR_STOP\s+on\s*$/gm,
    "",
  );

  return source.replace(/^\\ir\s+(.+?)\s*$/gm, (_line, relativePath: string) =>
    loadPsqlRehearsal(new URL(relativePath, sourceUrl)),
  );
}

export function isAcknowledgedDisposableJobberDatabase(): boolean {
  return (
    process.env.JOBBER_J1_DISPOSABLE_DB_ACK ===
      JOBBER_DISPOSABLE_DATABASE_ACK &&
    Boolean(process.env.JOBBER_J1_TEST_DATABASE_URL)
  );
}

export async function installForbiddenDomainFingerprints(
  client: PoolClient,
): Promise<void> {
  await client.query(loadPsqlRehearsal(fingerprintUtilityUrl));
}

export async function captureForbiddenDomainFingerprints(
  client: PoolClient,
  stage: string,
): Promise<void> {
  await client.query(
    "select pg_temp.capture_forbidden_domain_content($1::text)",
    [stage],
  );
}

export async function assertForbiddenDomainFingerprintsUnchanged(
  client: PoolClient,
  beforeStage: string,
  afterStage: string,
): Promise<void> {
  await client.query(
    "select pg_temp.assert_forbidden_domain_content_unchanged($1::text, $2::text)",
    [beforeStage, afterStage],
  );
}
