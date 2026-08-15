import { redirect } from "next/navigation";
import { requireFieldPropertyPageActor } from "@/lib/field-operations/field-access-dal";

interface LegacyHealthCheckRedirectProps {
  params: Promise<{ id: string }>;
}

/** Window-only quick path → assessment tool in window service mode. */
export default async function LegacyHealthCheckRedirect({
  params,
}: LegacyHealthCheckRedirectProps) {
  const { id } = await params;
  await requireFieldPropertyPageActor(
    id,
    `/tech/properties/${id}/health-check`,
  );
  redirect(`/tech/properties/${id}/assessment?mode=window_service`);
}
