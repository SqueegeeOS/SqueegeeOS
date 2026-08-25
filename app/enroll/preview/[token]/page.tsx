import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnrollmentHandoffPage } from "@/components/enrollment/enrollment-handoff-page";
import { isValidEnrollmentPreviewToken } from "@/lib/enrollment/preview-access";
import type { PublicEnrollmentStatus } from "@/lib/enrollment/public-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Enrollment Preview · HomeAtlas",
  description: "A non-binding customer-view demonstration of the HomeAtlas enrollment handoff.",
  robots: { index: false, follow: false, nocache: true },
};

const previewStatus: PublicEnrollmentStatus = {
  customerFirstName: "Michael",
  maskedEmail: "m•••••@example.com",
  propertyAddress: "Riley Residence · Customer preview",
  planName: "Quarterly Exterior Care Plan",
  cadence: "3 visits per year",
  firstVisitPriceCents: 50000,
  recurringVisitPriceCents: 50000,
  paymentRail: "manual_cash_check",
  status: "signature_sent",
  agreementComplete: false,
  paymentComplete: false,
  paymentUrl: null,
  paymentUrlExpiresAt: null,
  portalUrl: null,
  needsHelp: false,
  updatedAt: "2026-08-24T00:00:00.000Z",
};

export default async function EnrollmentPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidEnrollmentPreviewToken(token)) notFound();

  return (
    <EnrollmentHandoffPage
      token="preview"
      initialStatus={previewStatus}
      previewMode
    />
  );
}
