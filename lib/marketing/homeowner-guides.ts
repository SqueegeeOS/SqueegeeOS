export interface HomeownerGuide {
  slug: string;
  title: string;
  description: string;
  serviceSlug: string;
  sections: { title: string; paragraphs: string[] }[];
}

export const HOMEOWNER_GUIDES: HomeownerGuide[] = [
  {
    slug: "window-cleaning-quote-chico",
    title: "What goes into a window-cleaning quote in Chico?",
    description: "Compare window-cleaning quotes by scope: glass, screens, tracks, access, specialty work, and visit frequency.",
    serviceSlug: "window-cleaning",
    sections: [
      { title: "Start with the glass you want cleaned", paragraphs: ["Exterior-only cleaning and interior-and-exterior cleaning are different scopes. Tell us which you need, whether there are second-story windows, and whether any glass is difficult to reach. Window size, style, and access help us understand the work.", "A home's square footage can help start the conversation, but it does not explain every window. A clear description and property assessment help us prepare the final quote."] },
      { title: "Ask about screens, tracks, and sills", paragraphs: ["Two quotes can describe very different visits. Check whether screens, tracks, and sills are included, and ask how often you want each handled. An exterior visit does not automatically include every detail inside the home."] },
      { title: "Mention hard-water marks before booking", paragraphs: ["Mineral deposits and etched glass need a separate conversation from routine cleaning. Tell us where you see persistent marks so we can assess them and explain the proposed scope. We do not promise that ordinary cleaning will remove every mark in damaged glass."] },
      { title: "Compare the same visit frequency", paragraphs: ["A one-time quote and a recurring Home Care Plan may include different schedules and benefits. Compare the work in each visit, the price per visit, and the number of planned visits. Choose the rhythm that fits the property rather than comparing only the first number.", "To request a SqueegeeKing quote, share the address, the work you want, and the best way to reach you. We confirm scope and price before you approve the service."] },
    ],
  },
  {
    slug: "gutter-cleaning-planning-chico",
    title: "Planning gutter cleaning for your Chico home",
    description: "What to tell your gutter cleaner about leaves, overflow, downspouts, building height, and gutter guards.",
    serviceSlug: "gutter-cleaning",
    sections: [
      { title: "Plan around the property", paragraphs: ["A home under trees can have different maintenance needs from one with little overhead cover. Note where debris collects and what you have observed during rain. Those details help us discuss a sensible cleaning scope rather than assume every home needs the same schedule."] },
      { title: "Tell us where you have noticed overflow", paragraphs: ["If a gutter spills in one place, describe that location when requesting your quote. Ask which accessible gutter runs, outlets, and downspouts are included. Cleaning is a defined service; a leak, loose section, or damaged component may require a separate assessment."] },
      { title: "Mention height, access, and guards", paragraphs: ["Second-story sections, narrow side yards, landscaping, and gutter guards can change access and the work required. Share those details before the visit. You do not need to climb up to collect information for a quote; descriptions and photos taken safely from the ground can start the conversation."] },
      { title: "Coordinate the rest of the exterior", paragraphs: ["If you also need windows or other exterior cleaning, mention it when asking for gutter care. We can review a combined Home Care Plan and explain what each service covers before you decide."] },
    ],
  },
  {
    slug: "one-time-or-recurring-window-cleaning",
    title: "One-time or recurring window cleaning: which fits your home?",
    description: "Choose a cleaning schedule by the work you need, your preferences, and the details in your Home Care Plan.",
    serviceSlug: "home-care-memberships",
    sections: [
      { title: "Start with what you need today", paragraphs: ["You can book SqueegeeKing for one visit without joining a membership. A one-time service makes sense when you want a specific task handled now and would like to decide on future care later."] },
      { title: "Choose a rhythm you will actually use", paragraphs: ["Quarterly and twice-yearly plans are available, with a custom three-times-yearly option when it fits. Your preferred appearance, tree cover, exposure, and selected services help shape the conversation. Your written plan confirms the visits and scope."] },
      { title: "Choose each service's frequency", paragraphs: ["The same work does not have to happen every time. You may want exterior glass at each visit, screens on a different rhythm, and interior cleaning less often. Ask us to spell out those details so the plan matches how you use the home."] },
      { title: "Understand what membership keeps together", paragraphs: ["HomeAtlas is the private member portal included with SqueegeeKing membership. It connects your care plan, upcoming visits, property notes, service history, and available photos and documents.", "Before approving a membership, review the price per visit, frequency, benefits, billing details, and cancellation terms in your agreement. We can help you compare it with a one-time visit."] },
    ],
  },
  {
    slug: "solar-panel-cleaning-plan-chico",
    title: "How to plan solar panel cleaning in Chico",
    description: "Questions to ask about panel count, roof access, surface buildup, cleaning frequency, and combined service visits.",
    serviceSlug: "solar-panel-cleaning",
    sections: [
      { title: "Describe the system and its surroundings", paragraphs: ["Tell us the approximate panel count, whether there are multiple arrays, and where the panels sit on the property. Mention nearby trees and visible dust, leaves, or other buildup. Roof height, slope, and access are also part of reviewing the job."] },
      { title: "Discuss frequency after reviewing the property", paragraphs: ["We can quote one visit or discuss seasonal care. The useful schedule depends on the property and what collects on the panels. A single fixed schedule is not the right starting assumption for every home."] },
      { title: "Keep cleaning and system diagnosis separate", paragraphs: ["Our panel-cleaning quote focuses on the surface buildup and work included in the visit. It does not promise a particular increase in electricity production or diagnose an electrical fault. Bring performance or equipment concerns to the appropriate system professional."] },
      { title: "Ask about one coordinated visit", paragraphs: ["Solar panel cleaning can be quoted with windows and other exterior care. A combined Home Care Plan makes the scope and schedule visible in one place. Send the property address and requested services to start your quote."] },
    ],
  },
];

export function getHomeownerGuide(slug: string) {
  return HOMEOWNER_GUIDES.find((guide) => guide.slug === slug) ?? null;
}
