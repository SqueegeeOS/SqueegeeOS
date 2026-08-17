import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { buildAdminDashboard } from "@/lib/admin/build-dashboard";
import { loadBillingWorkspace } from "@/lib/admin/billing-workspace-server";
import { loadMembershipCommandCenter } from "@/lib/admin/membership-command-center-server";
import { isAdminPrivateBetaEnabled } from "@/lib/admin/server-auth";
import {
  findMemberMatches,
  prepareChargeReview,
} from "@/lib/concierge/operator-tools-core";

export const atlasOperatorTools = {
  getBusinessSnapshot: tool({
    description:
      "Read the current HomeAtlas operating snapshot. Use this for questions about revenue, members, requests, cards on file, billing readiness, or what needs attention. This tool is read-only.",
    inputSchema: z.object({}),
    execute: async () => {
      const [dashboard, members, billing] = await Promise.all([
        buildAdminDashboard([], isAdminPrivateBetaEnabled()),
        loadMembershipCommandCenter(),
        loadBillingWorkspace(),
      ]);

      return {
        asOf: new Date().toISOString(),
        executive: dashboard.executive,
        membership: {
          ...members.summary,
          membersDueThisMonth: members.monthView.membersDueCount,
          expectedMembershipRevenueThisMonth:
            members.monthView.expectedRevenue,
          dataConnected: members.connected,
        },
        billing: billing.overview,
        dataSources: dashboard.dataSources,
        safety: {
          readOnly: true,
          note: "No customer message or payment was sent by this tool.",
        },
      };
    },
  }),

  findMember: tool({
    description:
      "Find a HomeAtlas member by name and return only the operational facts needed in HQ. Contact details and street addresses are intentionally excluded. This tool is read-only.",
    inputSchema: z.object({
      query: z.string().trim().min(2).max(80),
    }),
    execute: async ({ query }) => {
      const data = await loadMembershipCommandCenter();
      const rows = [...data.activeMembers, ...data.pendingMembers];
      return {
        query,
        matches: findMemberMatches(rows, query),
        safety: {
          readOnly: true,
          contactDetailsShared: false,
        },
      };
    },
  }),

  prepareChargeReview: tool({
    description:
      "Prepare a non-executing HomeAtlas charge review for a named member. Use this whenever the operator asks to charge a card. It checks card, agreement, Jobber visit, duplicate-payment, and amount evidence, then returns the human-controlled Billing link. It never creates a Stripe payment or changes data.",
    inputSchema: z.object({
      customerName: z.string().trim().min(2).max(120),
      amount: z.number().positive().max(100_000),
      reason: z.string().trim().min(3).max(300),
    }),
    execute: async ({ customerName, amount, reason }) => {
      const billing = await loadBillingWorkspace();
      return prepareChargeReview(billing.rows, customerName, amount, reason);
    },
  }),
} as const;
