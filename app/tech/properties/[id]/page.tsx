import type { Metadata } from "next";
import Link from "next/link";
import {
  getPropertyHealthHeader,
  listStaffHealthChecks,
} from "@/lib/health/repository";

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
  const [property, checks] = await Promise.all([
    getPropertyHealthHeader(id),
    listStaffHealthChecks(id),
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

  const latest = checks[0] ?? null;
  const today = new Date().toISOString().split("T")[0]!;
  const hasCheckToday = checks.some((c) => c.visitDate === today);

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
        href={`/tech/properties/${id}/health-check`}
        className="mb-8 flex min-h-[56px] items-center justify-center rounded-2xl bg-[#c9a96e] px-6 text-center text-base font-medium tracking-wide text-black transition-transform active:scale-[0.98]"
      >
        {hasCheckToday ? "Update this visit&apos;s health check" : "Record health check for this visit"}
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
          </p>
        </section>
      )}

      <section>
        <p className="mb-3 text-[10px] uppercase tracking-widest text-[#444]">
          Visit history
        </p>
        {checks.length > 0 ? (
          <ul className="space-y-2">
            {checks.map((check) => (
              <li
                key={check.id}
                className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white">
                      {formatVisitDate(check.visitDate)}
                    </p>
                    <p className="text-xs text-[#444]">{check.technicianName}</p>
                  </div>
                  {check.overallScore != null && (
                    <p className="font-serif text-lg text-[#c9a96e]">
                      {check.overallScore}%
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#444]">
            No visits recorded yet. Save your first health check above.
          </p>
        )}
      </section>
    </div>
  );
}
