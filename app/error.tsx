"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ROUTES } from "@/lib/navigation/config";

export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100svh-var(--site-chrome-offset))] items-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-xl text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
          Temporary interruption
        </p>
        <h1 className="mt-5 font-serif text-4xl font-light sm:text-6xl">
          Let&apos;s try that once more.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
          Nothing you entered was intentionally discarded. Retry this page, or
          return home if the interruption continues.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
          >
            Try again
          </button>
          <Link
            href={ROUTES.home}
            className="rounded-full border border-border px-6 py-3 text-sm text-foreground"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
