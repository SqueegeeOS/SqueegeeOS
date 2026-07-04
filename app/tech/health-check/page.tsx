import { redirect } from "next/navigation";

interface LegacyHealthCheckRedirectProps {
  searchParams: Promise<{ propertyId?: string; visitId?: string; technician?: string }>;
}

/** Legacy URL — health checks now live under each property. */
export default async function LegacyHealthCheckRedirect({
  searchParams,
}: LegacyHealthCheckRedirectProps) {
  const params = await searchParams;
  const propertyId = params.propertyId?.trim();

  if (!propertyId) {
    redirect("/tech");
  }

  const query = new URLSearchParams();
  if (params.visitId) query.set("visitId", params.visitId);
  if (params.technician) query.set("technician", params.technician);

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  redirect(`/tech/properties/${propertyId}/health-check${suffix}`);
}
