import { createServerSupabaseClient, isSupabaseConfigured } from "./client";

/** Idempotent SQL — kept in sync with migrations/003_headquarters_profile.sql */
export const HEADQUARTERS_PROFILE_MIGRATION_SQL = `-- Headquarters cloud profile (singleton)
create table if not exists headquarters_profile (
  id text primary key default 'squeegeeking',
  business_started_date date,
  google_reviews_baseline integer not null default 0 check (google_reviews_baseline >= 0),
  homes_served_baseline integer not null default 0 check (homes_served_baseline >= 0),
  lifetime_revenue_baseline numeric(14, 2) not null default 0 check (lifetime_revenue_baseline >= 0),
  largest_month text not null default '',
  largest_job text not null default '',
  current_recurring_customers integer not null default 0 check (current_recurring_customers >= 0),
  about_noah text not null default '',
  about_dasan text not null default '',
  company_stand_for text not null default '',
  onboarding_complete boolean not null default false,
  headquarters_initialized boolean not null default false,
  founders jsonb not null default '["Noah Thomas", "Dasan Gramps"]'::jsonb,
  legacy_milestones jsonb not null default '[]'::jsonb,
  portrait_noah text,
  portrait_dasan text,
  lifetime_arr numeric(14, 2) not null default 0 check (lifetime_arr >= 0),
  closed_jobs_count integer not null default 0 check (closed_jobs_count >= 0),
  memberships_sold integer not null default 0 check (memberships_sold >= 0),
  active_members integer not null default 0 check (active_members >= 0),
  has_employee boolean not null default false,
  has_company_truck boolean not null default false,
  multi_city_expansion boolean not null default false,
  configured boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table headquarters_profile
  add column if not exists headquarters_initialized boolean not null default false;

create index if not exists headquarters_profile_updated_at_idx
  on headquarters_profile (updated_at desc);

create index if not exists headquarters_profile_initialized_idx
  on headquarters_profile (headquarters_initialized)
  where headquarters_initialized = true;

alter table headquarters_profile enable row level security;

drop policy if exists "headquarters_profile_anon_all" on headquarters_profile;
-- HQ profile: server-only via service role (no anon policy after migration 030).

insert into headquarters_profile (id)
values ('squeegeeking')
on conflict (id) do nothing;

update headquarters_profile
set headquarters_initialized = true
where onboarding_complete = true
  and headquarters_initialized = false;
`;

function isMissingTableError(message: string, code?: string): boolean {
  return (
    message.includes("does not exist") ||
    message.includes("headquarters_profile") ||
    code === "PGRST205"
  );
}

export async function headquartersProfileTableExists(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from("headquarters_profile")
      .select("id")
      .limit(1);

    if (!error) return true;
    return !isMissingTableError(error.message, error.code);
  } catch {
    return false;
  }
}

export function getHeadquartersDatabaseUrl(): string | null {
  return (
    process.env.SUPABASE_DB_URL?.trim() ??
    process.env.DATABASE_URL?.trim() ??
    null
  );
}

export async function runHeadquartersProfileMigration(): Promise<{
  ok: boolean;
  method: "database" | "manual";
  error?: string;
}> {
  const dbUrl = getHeadquartersDatabaseUrl();
  if (!dbUrl) {
    return {
      ok: false,
      method: "manual",
      error:
        "Automatic migration requires SUPABASE_DB_URL (PostgreSQL connection string from Supabase → Settings → Database).",
    };
  }

  try {
    const { Client } = await import("pg");
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    try {
      await client.query(HEADQUARTERS_PROFILE_MIGRATION_SQL);
    } finally {
      await client.end();
    }

    const exists = await headquartersProfileTableExists();
    if (!exists) {
      return {
        ok: false,
        method: "database",
        error: "Migration ran but headquarters_profile is still unreachable.",
      };
    }

    return { ok: true, method: "database" };
  } catch (error) {
    return {
      ok: false,
      method: "database",
      error: error instanceof Error ? error.message : "Migration failed",
    };
  }
}

export async function ensureHeadquartersProfileSchema(): Promise<{
  schemaReady: boolean;
  created: boolean;
  method: "existing" | "database" | "manual";
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      schemaReady: false,
      created: false,
      method: "manual",
      error: "Supabase not configured",
    };
  }

  const exists = await headquartersProfileTableExists();
  if (exists) {
    return { schemaReady: true, created: false, method: "existing" };
  }

  const migrated = await runHeadquartersProfileMigration();
  if (migrated.ok) {
    return { schemaReady: true, created: true, method: "database" };
  }

  return {
    schemaReady: false,
    created: false,
    method: migrated.method,
    error: migrated.error,
  };
}
