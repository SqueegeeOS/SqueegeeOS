import type { Metadata } from "next";
import Link from "next/link";
import { PresentationCard } from "@/components/presentations/presentation-card";
import { listPresentations } from "@/lib/presentations/repository";
import { platformPageTitle } from "@/lib/brand/platform";
import { requireHqPage } from "@/lib/auth/require-hq-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: platformPageTitle("Presentations"),
  robots: { index: false, follow: false },
};

export default async function PresentationsPage() {
  await requireHqPage("/presentations");
  const presentations = await listPresentations();

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 pb-20 pt-[calc(var(--site-chrome-offset)+1.5rem)] text-white">
      <div className="mx-auto max-w-lg">
        <header className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-[#555]">
            Field · Presentations
          </p>
          <h1 className="mt-1 font-serif text-2xl text-white">Your clients</h1>
          <p className="mt-2 text-sm text-[#555]">
            Tap a home to review details, then present full-screen at the
            driveway.
          </p>
        </header>

        <Link
          href="/presentations/new"
          className="mb-8 flex min-h-[52px] items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] text-sm text-[#666] transition-colors hover:border-[#c9a96e]/40 hover:text-[#c9a96e]"
        >
          + New presentation
        </Link>

        {presentations.length === 0 ? (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] px-6 py-12 text-center">
            <p className="text-sm text-[#444]">No presentations yet.</p>
            <p className="mt-2 text-xs text-[#333]">
              Create one before your next in-home close.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {presentations.map((presentation) => (
              <li key={presentation.id}>
                <PresentationCard presentation={presentation} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
