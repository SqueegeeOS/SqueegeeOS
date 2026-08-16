import type { Metadata } from "next";
import { JobberHeadquartersPage } from "@/components/admin/jobber-headquarters-page";
import { resolveJobberHandoffFocus } from "@/lib/care-operations/jobber-handoff-navigation";

export const metadata: Metadata = {
  title: "Jobber Workspace | Headquarters | SqueegeeKing",
  description:
    "Private SqueegeeKing workspace for Jobber synchronization and supervised HomeAtlas pairing.",
  robots: { index: false, follow: false },
};

export default async function HqJobberPage({
  searchParams,
}: {
  searchParams: Promise<{
    membership?: string | string[];
    step?: string | string[];
  }>;
}) {
  const focus = resolveJobberHandoffFocus(await searchParams);
  return <JobberHeadquartersPage focus={focus} />;
}
