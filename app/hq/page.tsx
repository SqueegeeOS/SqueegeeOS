import type { Metadata } from "next";
import { AdminExperience } from "@/components/admin/admin-experience";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: `Headquarters | SqueegeeKing`,
  description: `Private founder headquarters for SqueegeeKing on ${PLATFORM_BRAND.name}.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function HqPage() {
  return <AdminExperience />;
}
