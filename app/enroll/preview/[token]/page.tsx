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
  planName: "Quarterly Solar + Exterior Care Plan",
  cadence: "4 visits per year",
  firstVisitPriceCents: 30000,
  recurringVisitPriceCents: 30000,
  agreementSummary: {
    visitsPerYear: 4,
    annualTotalCents: 160000,
    planSummary:
      "Four planned visits alternating solar-only care with solar, exterior windows, and standard window screens.",
    customerChoiceNote:
      "Optional services are separate from the $1,600 annual plan and are added only when requested.",
    visits: [
      {
        label: "Visit 1",
        timing: "First quarterly visit",
        priceCents: 30000,
        includedServices: ["Solar panel cleaning"],
      },
      {
        label: "Visit 2",
        timing: "Second quarterly visit",
        priceCents: 50000,
        includedServices: [
          "Solar panel cleaning",
          "Exterior window cleaning",
          "Standard window-screen cleaning",
        ],
      },
      {
        label: "Visit 3",
        timing: "Third quarterly visit",
        priceCents: 30000,
        includedServices: ["Solar panel cleaning"],
      },
      {
        label: "Visit 4",
        timing: "Fourth quarterly visit",
        priceCents: 50000,
        includedServices: [
          "Solar panel cleaning",
          "Exterior window cleaning",
          "Standard window-screen cleaning",
        ],
      },
    ],
    optionalAddOns: [
      { label: "Interior window cleaning", priceCents: 15000 },
      { label: "Exterior cobweb removal around the home", priceCents: 4000 },
      {
        label: "Screened patio / enclosure screen cleaning",
        priceCents: 5000,
      },
    ],
    paymentSummary:
      "Cash or check account. No card on file and no automatic card billing.",
  },
  paymentRail: "manual_cash_check",
  signatureProvider: "homeatlas_native",
  status: "signature_sent",
  agreementComplete: false,
  signingAvailable: true,
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
