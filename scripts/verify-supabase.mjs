#!/usr/bin/env node
/**
 * Verify Supabase connection from the terminal.
 * Usage: npm run verify:supabase
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

console.log("Checking Supabase connection…");
console.log(`  URL: ${url}`);

const { error } = await supabase.from("homeowners").select("id").limit(1);

if (error) {
  console.error("\nConnection failed:");
  console.error(`  ${error.message}`);
  if (
    error.message.includes("does not exist") ||
    error.code === "PGRST205"
  ) {
    console.error("\nNext step: run lib/persistence/supabase/schema.sql in Supabase SQL Editor.");
  }
  process.exit(1);
}

const { count } = await supabase
  .from("home_care_plans")
  .select("*", { count: "exact", head: true });

console.log("\nSupabase connection OK");
console.log(`  home_care_plans count: ${count ?? 0}`);
console.log(`  persistence backend: ${process.env.NEXT_PUBLIC_PERSISTENCE_BACKEND ?? "session"}`);
console.log(`  supabase enabled: ${process.env.NEXT_PUBLIC_SUPABASE_ENABLED ?? "false"}`);
