import type { Metadata } from "next";
import { EnrollmentLegalReviewPage } from "@/components/admin/enrollment-legal-review-page";
import { getEnrollmentLegalReviewPacket } from "@/lib/enrollment/legal-review-packet";

export const metadata: Metadata = {
  title: "Agreement Release Packet | HomeAtlas HQ",
  description:
    "Private print-ready review packet for the HomeAtlas California enrollment documents.",
};

export default function HqEnrollmentReviewPage() {
  return (
    <EnrollmentLegalReviewPage packet={getEnrollmentLegalReviewPacket()} />
  );
}
