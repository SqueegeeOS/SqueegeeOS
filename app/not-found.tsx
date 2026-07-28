import Link from "next/link";
import { ROUTES } from "@/lib/navigation/config";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100svh-var(--site-chrome-offset))] items-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-xl text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
          Page not found
        </p>
        <h1 className="mt-5 font-serif text-4xl font-light sm:text-6xl">
          This path does not lead home.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
          The page may have moved, or the link may be incomplete. Start again
          from SqueegeeKing or request a Home Care Plan.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={ROUTES.home}
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
          >
            Return home
          </Link>
          <Link
            href={ROUTES.request}
            className="rounded-full border border-border px-6 py-3 text-sm text-foreground"
          >
            Request a plan
          </Link>
        </div>
      </div>
    </main>
  );
}
