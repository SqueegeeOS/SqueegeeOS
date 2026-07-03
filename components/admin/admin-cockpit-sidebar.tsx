"use client";

import { useMemo } from "react";
import type { ClosedJob } from "@/lib/admin/closed-jobs-types";
import { computeCompanyMilestones } from "@/lib/admin/milestones";
import { AdminBusinessTimeline } from "./admin-business-timeline";
import { AdminCompanyMilestones } from "./admin-company-milestones";
import { AdminTodaysFocusCard } from "./admin-todays-focus-card";

interface AdminCockpitSidebarProps {
  closedJobs: ClosedJob[];
  activeMembers: number;
  homeCarePlansCreated: number;
  showTodaysFocus?: boolean;
}

export function AdminCockpitSidebar({
  closedJobs,
  activeMembers,
  homeCarePlansCreated,
  showTodaysFocus = false,
}: AdminCockpitSidebarProps) {
  const milestones = useMemo(
    () =>
      computeCompanyMilestones({
        closedJobs,
        activeMembers,
        homeCarePlansCreated,
      }),
    [closedJobs, activeMembers, homeCarePlansCreated],
  );

  return (
    <div className="space-y-6">
      {showTodaysFocus && <AdminTodaysFocusCard />}
      <AdminCompanyMilestones milestones={milestones} />
      <AdminBusinessTimeline />
    </div>
  );
}
