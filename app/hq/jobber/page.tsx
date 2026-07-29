import type { Metadata } from "next";
import { JobberHeadquartersPage } from "@/components/admin/jobber-headquarters-page";

export const metadata: Metadata = {
  title: "Jobber Workspace | Headquarters | SqueegeeKing",
  description:
    "Private SqueegeeKing workspace for Jobber synchronization and supervised HomeAtlas pairing.",
  robots: { index: false, follow: false },
};

export default function HqJobberPage() {
  return <JobberHeadquartersPage />;
}
