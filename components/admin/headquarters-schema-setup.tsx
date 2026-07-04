"use client";

import { useCallback, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";

export function HeadquartersSchemaSetup({
  warning,
  onReady,
}: {
  warning?: string;
  onReady: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [migrationSql, setMigrationSql] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadMigrationSql = useCallback(async () => {
    const response = await fetch("/api/admin/headquarters-profile/migrate", {
      headers: getAdminRequestHeaders(),
    });
    if (!response.ok) return;
    const json = (await response.json()) as { migrationSql?: string | null };
    if (json.migrationSql) setMigrationSql(json.migrationSql);
  }, []);

  const runSetup = useCallback(async () => {
    setRunning(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/headquarters-profile/migrate", {
        method: "POST",
        headers: getAdminRequestHeaders(),
      });
      const json = (await response.json()) as {
        schemaReady?: boolean;
        error?: string;
        migrationSql?: string | null;
        method?: string;
      };

      if (json.migrationSql) setMigrationSql(json.migrationSql);

      if (json.schemaReady) {
        setStatusMessage("Cloud Headquarters database is ready.");
        onReady();
        return;
      }

      setStatusMessage(
        json.error ??
          "Could not create the headquarters_profile table automatically. Copy the SQL below into Supabase SQL Editor, run it once, then tap Retry.",
      );
    } catch {
      setStatusMessage("Setup request failed. Check your connection and retry.");
    } finally {
      setRunning(false);
    }
  }, [onReady]);

  const copySql = useCallback(async () => {
    if (!migrationSql) {
      await loadMigrationSql();
    }
    const sql = migrationSql ?? "";
    if (!sql) return;
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [loadMigrationSql, migrationSql]);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-5 py-16">
      <div className="max-w-2xl space-y-6 rounded-[1.75rem] border border-border/80 bg-surface/45 p-8">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
            Cloud Headquarters
          </p>
          <h1 className="mt-4 font-serif text-3xl font-light text-foreground">
            Set up shared Headquarters storage
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Headquarters needs one Supabase table so Noah and Dasan share the
            same company brain. We will create it automatically when database
            access is configured, or you can run the SQL once in Supabase.
          </p>
        </div>

        {(warning || statusMessage) && (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-800">
            {statusMessage ?? warning}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => void runSetup()}
            disabled={running}
            className="rounded-full border border-accent/30 bg-accent/[0.12] px-8 py-4 text-[10px] uppercase tracking-[0.22em] text-accent disabled:opacity-50"
          >
            {running ? "Setting up…" : "Create Cloud Headquarters table"}
          </button>
          <button
            type="button"
            onClick={() => onReady()}
            className="rounded-full border border-border px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-muted hover:border-accent/25 hover:text-accent"
          >
            Retry sync
          </button>
          <button
            type="button"
            onClick={() => void copySql()}
            className="rounded-full border border-border px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-muted hover:border-accent/25 hover:text-accent"
          >
            {copied ? "SQL copied" : "Copy migration SQL"}
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          Optional: add{" "}
          <code className="text-foreground/80">SUPABASE_DB_URL</code> in Vercel
          for fully automatic setup (Supabase → Settings → Database → connection
          string).
        </p>
      </div>
    </div>
  );
}
