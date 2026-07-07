import type { Metadata } from "next";
import Link from "next/link";
import { listTechnicianProperties } from "@/lib/health/repository";

export const metadata: Metadata = {
  title: "Today's Properties | Technician",
};

function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function TechHomePage() {
  const properties = await listTechnicianProperties();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-16">
      <header className="mb-8">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-[#555]">
          Atlas · Field
        </p>
        <h1 className="font-serif text-2xl text-white">Your properties</h1>
        <p className="mt-2 text-sm text-[#555]">
          Tap a home to record this visit&apos;s health check.
        </p>
      </header>

      {properties.length > 0 ? (
        <ul className="space-y-3">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/tech/properties/${property.id}`}
                className="block rounded-2xl border border-[#222] bg-[#111] px-5 py-4 transition-colors active:border-[#c9a96e]/40"
              >
                <p className="font-medium text-white">{property.name}</p>
                <p className="mt-0.5 text-sm text-[#666]">
                  {property.address}
                  {property.city ? ` · ${property.city}` : ""}
                </p>
                {property.customerName && (
                  <p className="mt-1 text-xs text-[#444]">
                    {property.customerName}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs">
                  {property.lastVisitDate ? (
                    <span className="text-[#555]">
                      Last check {formatVisitDate(property.lastVisitDate)}
                      {property.lastOverallScore != null &&
                        ` · ${property.lastOverallScore}%`}
                    </span>
                  ) : (
                    <span className="text-[#444]">No health check yet</span>
                  )}
                  <span className="text-[#c9a96e]">Open →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-[#222] bg-[#111] px-6 py-12 text-center">
          <p className="text-sm leading-relaxed text-[#555]">
            No properties yet. Homes you care for appear here once they&apos;ve
            been added.
          </p>
        </div>
      )}
    </div>
  );
}
