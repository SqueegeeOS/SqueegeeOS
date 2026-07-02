/**
 * Membership privileges — calm, confident copy for the member portal.
 */

export interface MemberPrivilege {
  id: string;
  title: string;
  tagline: string;
  description: string;
  detail?: string;
  featured?: boolean;
}

export const MEMBER_PRIVILEGES: MemberPrivilege[] = [
  {
    id: "vip-scheduling",
    title: "VIP Scheduling",
    tagline: "Priority access",
    description:
      "Your visits are scheduled with priority. When life shifts, we adjust — you are never an afterthought in our calendar.",
  },
  {
    id: "rain-guarantee",
    title: "7-Day Rain Guarantee",
    tagline: "Your guarantee",
    description:
      "Weather happens. If rain touches your glass within seven days of service, we return and make it right — without question.",
  },
  {
    id: "hard-water",
    title: "Hard Water Removal",
    tagline: "Included care",
    description:
      "Hard water buildup is handled as part of your quarterly service when needed. No separate invoices, no surprises.",
  },
  {
    id: "rainblock",
    title: "RainBlock Treatment",
    tagline: "Ongoing protection",
    description:
      "Each quarterly visit includes our RainBlock treatment — a quiet layer of protection that keeps glass clearer between visits.",
    detail: "Protection holds under normal conditions for approximately three months.",
    featured: true,
  },
];
