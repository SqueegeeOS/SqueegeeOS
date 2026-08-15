import type { Metadata } from "next";
import Link from "next/link";
import { listTechnicianProperties } from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Property Memory | Technician",
};

function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function TechnicianPropertiesPage() {
  const properties = await listTechnicianProperties();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-16">
      <Link
        href="/tech"
        className="mb-7 inline-flex min-h-11 items-center text-[10px] uppercase tracking-[0.2em] text-[#777]"
      >
        ← Today&apos;s field run
      </Link>
      <header className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#8fcfaf]">
          Atlas · Property memory
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
          All homes
        </h1>
        <p className="mt-2 text-sm text-[#777]">
          Open any home to review prior visits before the crew arrives.
        </p>
      </header>

      {properties.length > 0 ? (
        <ul className="space-y-3">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/tech/properties/${property.id}`}
                className="block min-h-24 rounded-2xl border border-[#262c2a] bg-[#111615] px-5 py-4 transition-colors active:border-[#9be2bd]/40"
              >
                <p className="font-medium text-white">{property.name}</p>
                <p className="mt-0.5 text-sm text-[#777]">
                  {property.address}
                  {property.city ? ` · ${property.city}` : ""}
                </p>
                {property.customerName ? (
                  <p className="mt-1 text-xs text-[#555]">
                    {property.customerName}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-between text-xs">
                  {property.lastVisitDate ? (
                    <span className="text-[#666]">
                      Last check {formatVisitDate(property.lastVisitDate)}
                      {property.lastOverallScore != null
                        ? ` · ${property.lastOverallScore}%`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-[#555]">No health check yet</span>
                  )}
                  <span className="text-[#9be2bd]">Open →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-[#262c2a] bg-[#111615] px-6 py-12 text-center">
          <p className="text-sm leading-relaxed text-[#777]">
            No properties yet. Paired HomeAtlas homes will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
