import type { Metadata } from "next";
import Link from "next/link";
import {
  listVisitMemory,
} from "@/lib/health/assessment-repository";
import {
  getPropertyHealthHeader,
} from "@/lib/health/repository";
import { assessmentTypeLabel } from "@/lib/health/assessment-types";

export const metadata: Metadata = {
  title: "Property Visit | Technician",
};

function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface TechPropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function TechPropertyPage({ params }: TechPropertyPageProps) {
  const { id } = await params;
  const [property, visits] = await Promise.all([
    getPropertyHealthHeader(id),
    listVisitMemory(id),
  ]);

  if (!property) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-[#555]">Property not found.</p>
        <Link href="/tech" className="mt-4 inline-block text-sm text-[#c9a96e]">
          ← All properties
        </Link>
      </div>
    );
  }

  const latest = visits[0] ?? null;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-16">
      <Link
        href="/tech"
        className="mb-6 inline-block text-[10px] uppercase tracking-widest text-[#555] hover:text-[#c9a96e]"
      >
        ← All properties
      </Link>

      <header className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#555]">
          Today&apos;s visit
        </p>
        <h1 className="font-serif text-2xl text-white">{property.name}</h1>
        <p className="mt-1 text-sm text-[#666]">{property.address}</p>
        {property.customerName && (
          <p className="mt-1 text-xs text-[#444]">{property.customerName}</p>
        )}
      </header>

      <Link
        href={`/tech/properties/${id}/visit`}
        className="mb-3 flex min-h-[56px] items-center justify-center rounded-2xl bg-[#c9a96e] px-6 text-center text-base font-medium tracking-wide text-black transition-transform active:scale-[0.98]"
      >
        Document today&apos;s visit
      </Link>

      <Link
        href={`/tech/properties/${id}/assessment`}
        className="mb-3 flex min-h-[48px] items-center justify-center rounded-2xl border border-[#333] px-6 text-center text-sm text-[#aaa] transition-colors hover:border-[#c9a96e] hover:text-[#c9a96e]"
      >
        Full health assessment
      </Link>

      <Link
        href={`/tech/properties/${id}/assessment?mode=window_service`}
        className="mb-8 block text-center text-xs text-[#555] underline underline-offset-2 hover:text-[#c9a96e]"
      >
        Quick window check only (~2 min)
      </Link>

      {latest && (
        <section className="mb-8 rounded-2xl border border-[#222] bg-[#111] px-5 py-5">
          <p className="text-[10px] uppercase tracking-widest text-[#444]">
            Latest care score
          </p>
          <p className="mt-2 font-serif text-4xl text-[#c9a96e]">
            {latest.overallScore ?? "—"}
            {latest.overallScore != null && (
              <span className="text-2xl text-[#666]">%</span>
            )}
          </p>
          <p className="mt-1 text-xs text-[#444]">
            {formatVisitDate(latest.visitDate)} · {latest.technicianName}
            {latest.assessmentType !== "legacy" &&
              ` · ${assessmentTypeLabel(latest.assessmentType)}`}
          </p>
        </section>
      )}

      <section>
        <p className="mb-3 text-[10px] uppercase tracking-widest text-[#444]">
          Visit history
        </p>
        {visits.length > 0 ? (
          <ul className="space-y-2">
            {visits.map((visit) => (
              <li
                key={visit.id}
                className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white">
                      {formatVisitDate(visit.visitDate)}
                    </p>
                    <p className="text-xs text-[#444]">
                      {visit.technicianName}
                      {visit.assessmentType !== "legacy" &&
                        ` · ${assessmentTypeLabel(visit.assessmentType)}`}
                    </p>
                  </div>
                  {visit.overallScore != null && (
                    <p className="font-serif text-lg text-[#c9a96e]">
                      {visit.overallScore}%
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#444]">
            No visits recorded yet. Start your first assessment above.
          </p>
        )}
      </section>
    </div>
  );
}
