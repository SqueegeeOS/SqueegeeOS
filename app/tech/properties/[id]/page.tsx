import type { Metadata } from "next";
import Link from "next/link";
import { AmbientStage } from "@/components/craft/ambient-stage";
import {
  listVisitMemory,
} from "@/lib/health/assessment-repository";
import {
  getPropertyHealthHeader,
} from "@/lib/health/repository";
import { assessmentTypeLabel } from "@/lib/health/assessment-types";
import {
  craftEyebrow,
  craftGhostLink,
  craftHeading,
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

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
    <AmbientStage className="text-white">
      <div className="mx-auto max-w-lg px-4 py-10 pb-20 sm:py-12">
      <Link
        href="/tech"
        className={`mb-8 inline-block ${craftGhostLink} !text-[10px] !uppercase !tracking-[0.2em] !no-underline`}
      >
        ← All properties
      </Link>

      <header className="mb-10">
        <p className={craftEyebrow}>Today&apos;s visit</p>
        <h1 className={`${craftHeading} mt-3 text-2xl sm:text-3xl`}>{property.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground/55">{property.address}</p>
        {property.customerName && (
          <p className="mt-1 text-xs text-muted">{property.customerName}</p>
        )}
      </header>

      <Link
        href={`/tech/properties/${id}/visit`}
        className={`mb-3 block w-full text-center ${craftPrimaryButton}`}
      >
        Document today&apos;s visit
      </Link>

      <Link
        href={`/tech/properties/${id}/assessment`}
        className={`mb-3 block w-full text-center ${craftSecondaryButton}`}
      >
        Full health assessment
      </Link>

      <Link
        href={`/tech/properties/${id}/assessment?mode=window_service`}
        className={`mb-10 block text-center ${craftGhostLink}`}
      >
        Quick window check only (~2 min)
      </Link>

      {latest && (
        <section className="craft-glass-subtle mb-10 rounded-[var(--radius-card)] px-5 py-5 shadow-[var(--shadow-ambient)]">
          <p className={craftEyebrow}>Latest care score</p>
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
                className="craft-glass-subtle rounded-[1.1rem] px-4 py-3.5 shadow-[var(--shadow-ambient)]"
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
    </AmbientStage>
  );
}
