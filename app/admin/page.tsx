import type { Metadata } from "next";
import { AdminExperience } from "@/components/admin/admin-experience";

export const metadata: Metadata = {
  title: "Command Center | SqueegeeKing",
  description: "Private owner command center for SqueegeeKing platform oversight.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminExperience />;
}
