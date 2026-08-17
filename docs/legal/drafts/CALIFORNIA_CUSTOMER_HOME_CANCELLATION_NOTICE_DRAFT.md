# California customer-home cancellation insert — conditional working draft

> **STATUTORY RELEASE CANDIDATE — DO NOT SEND THIS MARKDOWN FILE.** This insert is used only when the recorded sales context requires the California customer-home lane. The exact current statutory text, font, placement, language, deadline calculation, copies, and DocuSign delivery mechanics must be verified and owner-released. This is not legal advice; later counsel review should create a new version if changes are needed.

## Required packet data

- Seller legal name: `{{legal_company_name}}`
- Seller business address: `{{legal_business_address}}`
- Cancellation email: `{{legal_notice_email}}`
- Seller phone: `{{legal_phone}}`
- Buyer name: `{{customer_name}}`
- Service address: `{{property_address}}`
- Transaction date: `{{agreement_date}}`
- Presentation/contract language: `{{presentation_language}}`
- Buyer lane: `{{standard_or_senior_lane}}`
- Cancellation deadline: `{{statutory_cancellation_deadline}}`

The released packet must calculate the deadline from the transaction date using the current statutory business-day rule. It must never ask a salesperson to type the deadline from memory.

## First-page seller and transaction block

The first page should display the seller's legal name, business address, cancellation email, phone, and the date signed in ordinary body-size text. The transaction date and seller identity must remain locked to the HomeAtlas packet snapshot.

## Signature-adjacent statement

For the standard lane, the working statement is:

> **You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.**

For a buyer who qualifies for the senior lane, the working statement substitutes **fifth business day** for **third business day**.

The released DocuSign template must place the applicable statement immediately next to the signature in at least the legally required bold type size. It must not show both lanes to the customer.

## Notice of Cancellation form

The released packet should contain the current statutory form twice, completed with the transaction date, seller name, seller business address, cancellation email, and exact deadline. Its customer-facing substance must state that the buyer may cancel without penalty or obligation within the applicable three- or five-business-day period; explain return of payments, instruments, property, and security interests; explain the handling of goods delivered to the residence when relevant; and allow cancellation by email, mail, delivery, or another legally permitted written notice.

Each copy should provide fields for the cancellation date and buyer signature. The form should remain detachable or independently retainable in the electronic packet. The owner-release check must compare the exact statutory form and confirm how DocuSign provides the required retainable copies; later counsel may revise the interpretation in a new version.

## Same-language and oral-explanation controls

The contract and notice must be in the same language principally used in the oral presentation. Before signing, the field-rep workflow should require the salesperson to confirm that the buyer was orally told about the right to cancel and the requirement that cancellation be written. HomeAtlas should record the salesperson, language, time, lane, and confirmation as operational evidence without treating a checkbox as a substitute for required conduct.

## Customer delivery and cancellation intake

The customer receives the completed agreement and both notice copies through DocuSign in a retainable form. A cancellation may be sent to `{{legal_notice_email}}`, delivered or mailed to `{{legal_business_address}}`, or submitted through HomeAtlas's direct cancellation control as an additional unobstructed intake method.

HomeAtlas should timestamp the request, preserve the original message, immediately stop uninitiated future billing and scheduling automation, and create an owner-visible case. The workflow must not require a reason or retention conversation before recording the request.

## Release checklist

1. The owner checks the current Civil Code sections 1689.5–1689.7 lane for SqueegeeKing's D2D membership transaction and records the selected sales context.
2. The owner verifies the exact standard and senior statements, statutory form, language treatment, and electronic duplicate-copy mechanics against the current primary source.
3. HomeAtlas calculates and tests the cancellation deadline around weekends and California holidays.
4. DocuSign renders the statement at the required size and proximity to the signature on both mobile and desktop.
5. David's field flow records location, language, senior lane when applicable, oral explanation, delivery, and customer signature.
6. A controlled test proves the customer can retain the signed packet and submit a cancellation without obstruction.
