import type { Metadata } from "next";
import { AdminExperience } from "@/components/admin/admin-experience";

export const metadata: Metadata = {
  title: "Headquarters | SqueegeeKing",
  description: "Private founder headquarters for SqueegeeKing platform oversight.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HqPage() {
  return <AdminExperience />;
}
