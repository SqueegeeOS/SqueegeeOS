#!/usr/bin/env node
/**
 * Create headquarters_profile in Supabase (one-time).
 * Usage: npm run migrate:headquarters
 *
 * Requires SUPABASE_DB_URL or DATABASE_URL in .env.local
 * (Supabase → Settings → Database → Connection string).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.error("Could not read .env.local");
    process.exit(1);
  }
}

loadEnvLocal();

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL or DATABASE_URL in .env.local");
  console.error("Get it from Supabase → Settings → Database → Connection string");
  process.exit(1);
}

const sqlPath = resolve(
  process.cwd(),
  "lib/persistence/supabase/migrations/003_headquarters_profile.sql",
);
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

console.log("Running Headquarters cloud migration…");

try {
  await client.connect();
  await client.query(sql);
  console.log("\n✓ headquarters_profile table ready");
  console.log("  Next: open /hq — Noah's local archive will auto-import once.");
} catch (error) {
  console.error("\nMigration failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
