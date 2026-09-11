import type { Metadata } from "next";
import { EnrollmentDeskPage } from "@/components/admin/enrollment-desk-page";

export const metadata: Metadata = {
  title: "Enrollment Desk | HomeAtlas HQ",
  description: "Private HomeAtlas signing and Stripe card-on-file operations.",
};

export default function HqEnrollmentPage() {
  return <EnrollmentDeskPage />;
}
