export type EnrollmentLegalReviewDocumentId =
  | "master_service_agreement"
  | "service_quote_agreement"
  | "customer_home_cancellation_notice";

export interface EnrollmentLegalReviewSection {
  heading: string;
  paragraphs: string[];
}

export interface EnrollmentLegalReviewDocument {
  id: EnrollmentLegalReviewDocumentId;
  title: string;
  version: string;
  purpose: string;
  status: "working_draft" | "lawyer_text_required";
  sections: EnrollmentLegalReviewSection[];
  reviewFocus: string[];
}

export interface EnrollmentLegalReviewPacket {
  packetLabel: string;
  summary: string;
  documents: EnrollmentLegalReviewDocument[];
  customerJourney: Array<{
    step: number;
    title: string;
    detail: string;
  }>;
  operatingRules: string[];
  sourceLinks: Array<{
    label: string;
    href: string;
  }>;
}

/**
 * Internal review copy for HomeAtlas HQ. This makes the intended agreement
 * architecture inspectable without turning a working draft into a live
 * customer document. Customer sends remain controlled by the independently
 * versioned, hashed agreement rows in Supabase.
 */
export function getEnrollmentLegalReviewPacket(): EnrollmentLegalReviewPacket {
  return {
    packetLabel: "California HomeAtlas enrollment packet",
    summary:
      "One DocuSign envelope contains the durable Master Service Agreement and the property-specific Service & Quote Agreement. The complete proposed drafts now cover service standards, visit-by-visit scope, card or owner-approved cash/check, add-ons, renewal, cancellation, responsibility, and dispute handling. After signing, a separate Stripe-hosted page collects a card when that rail is selected. HomeAtlas retains the exact document snapshot, provider evidence, and portal handoff as one enrollment record.",
    documents: [
      {
        id: "master_service_agreement",
        title: "California Master Service Agreement",
        version: "ca-msa-v1-draft",
        purpose:
          "The durable relationship layer. It should rarely change when a customer changes a visit, service, or price.",
        status: "working_draft",
        sections: [
          {
            heading: "1. Parties and agreement structure",
            paragraphs: [
              "The exact California LLC legal name, business address, notice email, and phone identify the Service Provider. The customer is identified by name and email.",
              "This MSA governs the continuing service relationship. Every property, service cadence, visit scope, first rate, continuing rate, and first-year estimate belongs in a separately accepted Property Service & Quote Agreement.",
            ],
          },
          {
            heading: "2. Accepted work only",
            paragraphs: [
              "SqueegeeKing performs only work shown in an accepted property agreement, a customer-approved add-on, or another signed service order. A conversation, public estimate, or Jobber draft does not silently expand the scope.",
            ],
          },
          {
            heading: "3. Access, safety, and customer responsibilities",
            paragraphs: [
              "The customer provides lawful and reasonably safe access, secures pets, discloses known hazards, and completes any stated preparations. SqueegeeKing may pause, reschedule, or decline unsafe or inaccessible work.",
              "Weather, smoke, water restrictions, equipment conditions, and events outside reasonable control may require rescheduling without converting the service target into a guaranteed date.",
            ],
          },
          {
            heading: "4. Care standard and service concerns",
            paragraphs: [
              "Accepted services are performed professionally against the written scope. The customer may report a concern through the private portal, notice email, or published company phone so the concern and response remain attached to the property record.",
              "The proposed draft uses a three-calendar-day reporting window for reasonably discoverable concerns and a fair inspection, re-service, correction, credit, or affected-line-item refund as the first remedy, while preserving non-waivable rights.",
            ],
          },
          {
            heading: "5. Scheduling and service personnel",
            paragraphs: [
              "Exact service dates may move for weather, safety, access, or operational reasons. SqueegeeKing may use trained employees or insured service partners who remain subject to the accepted scope and care standard.",
            ],
          },
          {
            heading: "6. Payment framework",
            paragraphs: [
              "The MSA creates no price by itself. The property agreement controls prices, included work, optional work, taxes, credits, cadence, and the selected payment rail.",
              "For card-on-file accounts, the customer enters payment details only on Stripe's hosted page after signing. HomeAtlas stores provider references, not the full card number. A later charge still requires the signed authorization and HomeAtlas billing safety gates.",
              "For an owner-approved cash/check account, no automatic card charge is attempted; the property agreement states the due date and HomeAtlas records the manual payment and receipt reference.",
            ],
          },
          {
            heading: "7. Electronic records and communications",
            paragraphs: [
              "The parties consent to electronic records and signatures. Transactional notices may go to the supplied email or phone. Marketing text consent remains separate and is not a condition of purchase.",
              "HomeAtlas retains the signed documents, DocuSign completion certificate, accepted property snapshot, relevant notices, and provider event references as the transaction record.",
            ],
          },
          {
            heading: "8. Cancellation, suspension, and termination",
            paragraphs: [
              "The property agreement controls its initial term, renewal, enrollment-savings treatment, and property-specific cancellation terms. A statutory cancellation right controls over a conflicting contract term.",
              "The customer can submit written cancellation through the private portal or the legal notice email. The final reviewed version must state the effective date, treatment of already initiated charges and scheduled services, and any right to suspend service for nonpayment or unsafe access.",
            ],
          },
          {
            heading: "9. Warranty and liability framework",
            paragraphs: [
              "The working position is a fair re-service-first remedy for a verified scope issue, with no promise that exterior surfaces will remain clean after weather, construction, irrigation, animals, or other new conditions.",
              "The complete proposal assigns direct harm according to each party's negligence, misconduct, fraud, or material breach; excludes only remote or speculative losses to the extent lawful; and preserves non-waivable California rights. It proposes no hidden consumer indemnity or mandatory arbitration clause.",
            ],
          },
          {
            heading: "10. Disputes and governing law",
            paragraphs: [
              "The proposed process is written notice followed by at least 15 days for a good-faith attempt to resolve the issue, without blocking time-sensitive relief, small-claims rights, or statutory remedies. California law applies and the draft does not require private arbitration.",
            ],
          },
          {
            heading: "11. General contract terms",
            paragraphs: [
              "The proposed draft covers notices, assignment with continuity on a business sale, waiver, severability, signed amendments, electronic counterparts, survival, and the complete-agreement rule. A later signed writing changes an earlier term only to the extent it says so.",
            ],
          },
          {
            heading: "12. Order of precedence and acceptance",
            paragraphs: [
              "The property agreement controls a conflict about scope, property details, cadence, rates, add-ons, cancellation disclosures, or renewal disclosures. The MSA controls the remaining relationship terms.",
              "The customer receives both documents before one DocuSign acceptance. The signed envelope version and completion certificate become the durable record.",
            ],
          },
        ],
        reviewFocus: [
          "Exact LLC identity and notice details",
          "Re-service window and remedy",
          "Insurance and service-partner wording",
          "Liability, indemnity, disputes, venue, and fees",
          "Cancellation effective-date and suspension language",
        ],
      },
      {
        id: "service_quote_agreement",
        title: "Property Service & Quote Agreement",
        version: "ca-service-quote-v1-draft",
        purpose:
          "The plain-language deal sheet. This is where the customer sees exactly what happens at each visit and exactly what it costs.",
        status: "working_draft",
        sections: [
          {
            heading: "Customer and property",
            paragraphs: [
              "Customer name, email, phone, service address, selected property, and the incorporated MSA version are shown together.",
            ],
          },
          {
            heading: "Care plan and visit-by-visit scope",
            paragraphs: [
              "The plan identifies biannual, triannual, quarterly, or a customized cadence. Every visit separately marks exterior windows, interior windows, screens, cobweb removal, solar panels, pressure washing, and other work as included, optional, or not included.",
              "The public website estimate remains exterior-only unless this property agreement expressly adds interior work, screens, cobweb removal, or another service.",
            ],
          },
          {
            heading: "Prices the customer can understand",
            paragraphs: [
              "The first-visit rate, continuing per-visit rate, visit-specific price, estimated first-year total, taxes, credits, and add-on rules are displayed separately. A changed rate is prospective and never silently edits a signed snapshot.",
            ],
          },
          {
            heading: "Scheduling and access",
            paragraphs: [
              "The accepted cadence sets the service plan while Jobber supplies operational dates. Weather, access, and safety may move a date. The deal snapshot includes the selected no-access and rescheduling process, and schedule visibility never becomes billing authority by itself.",
            ],
          },
          {
            heading: "Standing payment authorization",
            paragraphs: [
              "For a card account, the customer affirmatively authorizes variable off-session charges for accepted Jobber-scheduled services under the stated first-of-service-month process. Optional or additional work still requires customer approval before it is scheduled or charged.",
              "The payment method is entered on a separate Stripe-hosted page after DocuSign. Saving the method does not itself collect a payment.",
            ],
          },
          {
            heading: "Cash/check and add-on controls",
            paragraphs: [
              "An owner-approved cash/check account is expressly identified, is never represented as card-ready, and records a manual due date, payment method, amount, and receipt reference.",
              "A one-visit add-on records its work, disclosed price or pricing method, affected visit, and customer approval. It does not silently become part of future visits; a permanent change uses a signed amendment or replacement property agreement.",
            ],
          },
          {
            heading: "Cancellation, renewal, and changes",
            paragraphs: [
              "The agreement states the initial term, renewal behavior, 30-day written-notice policy, any enrollment-savings reimbursement, statutory cancellation rights, and the direct portal/email cancellation methods.",
              "A clear confirmation block immediately before signing shows the renewal period, amount or range and frequency of charges, and cancellation methods. A fee or material-term change notice identifies the current term, new term, effective date, and direct cancellation method before taking effect.",
            ],
          },
          {
            heading: "Property agreement controls the deal",
            paragraphs: [
              "If the documents conflict about this property's scope, first or continuing rate, cadence, add-ons, cancellation disclosure, or renewal disclosure, this property agreement controls.",
            ],
          },
        ],
        reviewFocus: [
          "Automatic-renewal disclosure placement and affirmative consent",
          "Variable-charge range and add-on approval evidence",
          "Initial term and enrollment-savings reimbursement",
          "Fee/material-change notice timing",
          "Exact cancellation and renewal reminders",
        ],
      },
      {
        id: "customer_home_cancellation_notice",
        title: "California customer-home cancellation notice",
        version: "provider-template-text-pending",
        purpose:
          "A conditional notice for an agreement made at the customer's home. It is included only when the recorded sales context requires it.",
        status: "lawyer_text_required",
        sections: [
          {
            heading: "When HomeAtlas uses this lane",
            paragraphs: [
              "A customer-home sale records its location and the selected cancellation lane before a packet can send. Remote and normal business-premises transactions do not automatically receive this insert.",
            ],
          },
          {
            heading: "What the final DocuSign template must handle",
            paragraphs: [
              "The template needs the required signature-adjacent statement, transaction date, seller identity, cancellation address or method, same-language contract treatment, oral explanation, and required cancellation-form copies.",
              "A concrete conditional insert now proposes the standard and senior lanes, deadline variables, first-page seller block, retainable copies, same-language control, oral-explanation evidence, and unobstructed cancellation intake. The lawyer must still confirm applicability and the exact released form; HomeAtlas never improvises it at send time.",
            ],
          },
        ],
        reviewFocus: [
          "Whether this window-cleaning membership is a covered home-solicitation contract",
          "Correct cancellation period for each customer",
          "Exact notice wording, page placement, and copy mechanics",
          "Required oral explanation for David and future field reps",
        ],
      },
    ],
    customerJourney: [
      {
        step: 1,
        title: "HomeAtlas freezes the accepted deal",
        detail:
          "Customer, property, visit sequence, services, prices, sales context, disclosures, and agreement versions become one immutable packet snapshot.",
      },
      {
        step: 2,
        title: "DocuSign emails one clear envelope",
        detail:
          "The customer reviews the MSA and their property-specific agreement on their own phone, then signs once through DocuSign.",
      },
      {
        step: 3,
        title: "HomeAtlas verifies and stores the evidence",
        detail:
          "A signed webhook is verified before the completed PDF and certificate are stored in the private agreement vault.",
      },
      {
        step: 4,
        title: "Stripe receives the card directly",
        detail:
          "Only after signature completion does the customer receive a separate Stripe-hosted Setup Mode link. No payment is collected merely by saving the card.",
      },
      {
        step: 5,
        title: "The private home portal turns on",
        detail:
          "After the agreement and payment rail are ready, HomeAtlas activates the durable customer/property record and portal handoff.",
      },
    ],
    operatingRules: [
      "Never send a packet whose two document versions are not approved and content-hashed.",
      "Never collect a card before the customer completes the agreement.",
      "Never silently replace a signed scope, price, cadence, or disclosure; use a signed amendment or new property agreement.",
      "Keep schedule visibility separate from billing authority.",
      "Keep transactional messaging consent separate from marketing consent.",
      "Preserve a direct retainable cancellation method in the portal and by email.",
    ],
    sourceLinks: [
      {
        label: "California Business and Professions Code § 17602",
        href: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602",
      },
      {
        label: "California Civil Code § 1689.7",
        href: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1689.7",
      },
      {
        label: "California Civil Code § 1633.7",
        href: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1633.7",
      },
      {
        label: "California Civil Code § 1671",
        href: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1671",
      },
      {
        label: "California DOJ automatic-renewal guidance",
        href: "https://oag.ca.gov/news/press-releases/attorney-general-bonta-issues-consumer-alert-california%E2%80%99s-automatic-renewal-law",
      },
    ],
  };
}
