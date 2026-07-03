"use client";

import { useMemo } from "react";
import type { ClosedJob } from "@/lib/admin/closed-jobs-types";
import { computeCurrentMissions } from "@/lib/admin/current-mission";
import type { OperatingContext } from "@/lib/admin/growth-journey";
import { AdminBusinessTimeline } from "./admin-business-timeline";
import { AdminCurrentMission } from "./admin-current-mission";
import { AdminTodaysFocusCard } from "./admin-todays-focus-card";

interface AdminCockpitSidebarProps {
  closedJobs: ClosedJob[];
  activeMembers: number;
  homeCarePlansCreated: number;
  pendingRequests: number;
  showTodaysFocus?: boolean;
}

export function AdminCockpitSidebar({
  closedJobs,
  activeMembers,
  homeCarePlansCreated,
  pendingRequests,
  showTodaysFocus = false,
}: AdminCockpitSidebarProps) {
  const context = useMemo<OperatingContext>(
    () => ({
      closedJobs,
      activeMembers,
      homeCarePlansCreated,
      pendingRequests,
    }),
    [closedJobs, activeMembers, homeCarePlansCreated, pendingRequests],
  );

  const missions = useMemo(() => computeCurrentMissions(context), [context]);

  return (
    <div className="space-y-6">
      {showTodaysFocus && <AdminTodaysFocusCard />}
      <AdminCurrentMission missions={missions} />
      <AdminBusinessTimeline />
    </div>
  );
}
