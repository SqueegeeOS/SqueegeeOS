import type { Metadata } from "next";
import { EnrollmentDeskPage } from "@/components/admin/enrollment-desk-page";

export const metadata: Metadata = {
  title: "Enrollment Desk | HomeAtlas HQ",
  description: "Private DocuSign, Stripe, and HomeAtlas enrollment operations.",
};

export default function HqEnrollmentPage() {
  return <EnrollmentDeskPage />;
}
