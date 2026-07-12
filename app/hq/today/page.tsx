import type { Metadata } from "next";
import { TodayWorkspacePage } from "@/components/admin/today-workspace-page";

export const metadata: Metadata = {
  title: "Today | Headquarters | SqueegeeKing",
  description: "Run today's scheduled care from arrival through payment.",
  robots: { index: false, follow: false },
};

export default function HqTodayPage() {
  return <TodayWorkspacePage />;
}
