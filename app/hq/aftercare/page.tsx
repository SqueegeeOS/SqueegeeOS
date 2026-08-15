import type { Metadata } from "next";
import { CustomerAftercarePage } from "@/components/admin/customer-aftercare-page";

export const metadata: Metadata = {
  title: "Aftercare · Headquarters",
  robots: { index: false, follow: false },
};

export default function AftercarePage() {
  return <CustomerAftercarePage />;
}
