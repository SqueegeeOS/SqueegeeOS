import type { Metadata } from "next";
import { RequestForm } from "@/components/acquisition/request-form";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";

export const metadata: Metadata = {
  title: "Request Your Home Care Plan",
  description: `Begin your personalized Home Care Plan with ${CUSTOMER_BRAND.name} — premium home care in Chico, California.`,
  alternates: { canonical: "/request" },
  openGraph: {
    title: `Request Your Home Care Plan | ${CUSTOMER_BRAND.name}`,
    description: `Begin a personalized home care plan with ${CUSTOMER_BRAND.name} in Chico, California.`,
    url: "/request",
    type: "website",
  },
};

export default function RequestPage() {
  return <RequestForm />;
}
