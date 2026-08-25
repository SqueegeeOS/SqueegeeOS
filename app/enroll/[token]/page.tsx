import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnrollmentHandoffPage } from "@/components/enrollment/enrollment-handoff-page";
import { loadPublicEnrollmentStatus } from "@/lib/enrollment/public-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your HomeAtlas Handoff",
  robots: { index: false, follow: false, nocache: true },
};

export default async function EnrollmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ payment?: string; signing?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const status = await loadPublicEnrollmentStatus(token);
  if (!status) notFound();
  return (
    <EnrollmentHandoffPage
      token={token}
      initialStatus={status}
      paymentResult={query.payment ?? null}
      signingResult={query.signing ?? null}
    />
  );
}
