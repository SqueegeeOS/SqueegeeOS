import Link from "next/link";
import { redirect } from "next/navigation";

interface LegacyHealthCheckRedirectProps {
  params: Promise<{ id: string }>;
}

/** Window-only quick path → assessment tool in window service mode. */
export default async function LegacyHealthCheckRedirect({
  params,
}: LegacyHealthCheckRedirectProps) {
  const { id } = await params;
  redirect(`/tech/properties/${id}/assessment?mode=window_service`);
}
