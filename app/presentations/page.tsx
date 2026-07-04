import type { Metadata } from "next";
import Link from "next/link";
import { PresentationCard } from "@/components/presentations/presentation-card";
import { listPresentations } from "@/lib/presentations/repository";
import { platformPageTitle } from "@/lib/brand/platform";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("Presentations"),
  robots: { index: false, follow: false },
};

export default async function PresentationsPage() {
  const presentations = await listPresentations();

  return (
    <div
      className="min-h-screen bg-background px-5 pb-20 sm:px-10"
      style={{ paddingTop: "calc(var(--site-chrome-offset) + 1.5rem)" }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
              HomeAtlas
            </p>
            <h1 className="mt-2 font-serif text-4xl font-light text-foreground">
              Presentations
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted">
              Pre-load client details, present full-screen, and close with a live
              signature.
            </p>
          </div>
          <Link
            href="/presentations/new"
            className="inline-flex min-h-[48px] items-center rounded-full bg-accent px-6 text-sm font-medium tracking-[0.08em] text-background"
          >
            New Presentation
          </Link>
        </div>

        <div className="mt-10 space-y-4">
          {presentations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
              No presentations yet. Create one to start a live close.
            </div>
          ) : (
            presentations.map((presentation) => (
              <PresentationCard
                key={presentation.id}
                presentation={presentation}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
