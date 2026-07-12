"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MEMBERSHIP_CLOSE_BILLING_BULLETS } from "@/lib/agreement/agreement-content";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import { Eyebrow, HeroText } from "@/components/presentations/slide-primitives";
import {
  ExpandLink,
  ProcessTimeline,
} from "@/components/presentations/slides/visual-primitives";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { CardOnFileSetup } from "@/components/membership/card-on-file-setup";
import { FoundingMemberHonor } from "@/components/membership/founding-member-honor";
import { MemberWalletCard } from "@/components/membership/member-wallet-card";
import type { MemberWalletCardData } from "@/lib/membership/member-wallet-card-data";
import { HomeAtlasJourneySection } from "@/components/membership/homeatlas-journey-section";
import { buildPortalCareRecordView } from "@/lib/membership/portal-view-model";
import { HomeAtlasSavingsSection } from "@/components/portal/homeatlas-savings-section";
import { CareAddonsSection } from "@/components/portal/care-addons-section";
import { NextCareVisitHero } from "@/components/portal/next-care-visit-hero";
import { PortalCard, PortalSection } from "@/components/portal/portal-section";
import { ReferralSection } from "@/components/portal/referral-section";
import { GlassCard } from "@/components/craft/glass-card";
import { PortalStage } from "@/components/portal/portal-stage";
import { InstallHomeAtlas } from "@/components/pwa/InstallHomeAtlas";
import { craftPrimaryButton, craftSecondaryButton } from "@/lib/craft/tokens";
import { materialize } from "@/lib/motion/system";

interface MemberPortalExperienceProps {
  data: HomeCarePlanData;
  portalData?: MemberPortalData | null;
  portalBasePath?: string;
  customerPortalMode?: "token" | "slug";
  portalToken?: string | null;
}

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed text-foreground/70">
      <span className="mt-0.5 text-accent" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

export function MemberPortalExperience({
  data,
  portalData,
  portalBasePath,
  customerPortalMode = "slug",
  portalToken = null,
}: MemberPortalExperienceProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const view = buildPortalCareRecordView(data, portalData);
  const isCustomerPortal = customerPortalMode === "token";
  const resolvedPortalPath =
    portalBasePath ??
    `/homecare/${data.homeowner.slug}/${data.property.slug}/portal`;

  const [membershipOpen, setMembershipOpen] = useState(false);
  const [whatsNextOpen, setWhatsNextOpen] = useState(false);
  const [updatePaymentOpen, setUpdatePaymentOpen] = useState(false);

  const walletCard: MemberWalletCardData = {
    brandName: CUSTOMER_BRAND.name,
    memberName: view.firstName,
    tierLabel: view.tierMemberLabel,
    addonDiscountLabel: view.addonDiscountLabel,
    addonDiscountPercent: view.addonDiscountPercent,
    memberSinceLabel: `Member since ${view.memberSinceFormatted}`,
    isActive: view.membershipActive,
  };

  const agreementPdfHref =
    view.agreement?.pdfUrl?.startsWith("http") ||
    view.agreement?.pdfUrl?.startsWith("/")
      ? view.agreement.pdfUrl
      : null;

  const showAgreement =
    view.agreement &&
    (view.membershipActive || view.pendingPayment || view.paymentOnFile);

  const paymentHeadline = view.paymentHeadline;

  const handlePaymentSuccess = () => {
    setUpdatePaymentOpen(false);
    router.refresh();
  };

  const resolvedPortalToken =
    portalToken ??
    (customerPortalMode === "token" && portalBasePath
      ? portalBasePath.match(/^\/portal\/([^/]+)/)?.[1] ?? null
      : null);

  return (
    <PortalStage
      founding={Boolean(view.foundingDisplay)}
      savedTheme={portalData?.portalTheme ?? null}
      membershipId={portalData?.membershipId ?? null}
      portalToken={resolvedPortalToken}
      homeownerSlug={data.homeowner.slug}
      propertySlug={data.property.slug}
    >
      <div className="mx-auto max-w-2xl px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] sm:px-10 sm:pb-20 sm:pt-16">
        {/* §1 — Landing */}
        <motion.header
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={materialize}
          className="text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.35em] text-accent/70">
            {CUSTOMER_BRAND.name}
          </p>
          <div
            className="mx-auto mt-6 mb-8 h-px w-12 bg-accent/25"
            aria-hidden
          />
          <HeroText>{view.landingHeadline}</HeroText>
          <p className="mt-5 text-base text-foreground/60 sm:text-lg">
            {view.propertyAddress}
          </p>
          {view.syncNote && (
            <p className="mt-4 text-sm text-foreground/45">{view.syncNote}</p>
          )}
          {view.membershipActive && (
            <p className="mt-6 inline-flex rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-accent">
              {view.tierMemberLabel} · Active
            </p>
          )}
          {view.pendingPayment && (
            <p className="mt-6 inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-amber-100/90">
              Almost there
            </p>
          )}
        </motion.header>

        {(view.membershipActive || view.pendingPayment) && (
          <NextCareVisitHero visit={view.nextCareVisit} />
        )}

        <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-24">
          {/* §2 — Membership */}
          <PortalSection
            id="membership"
            index={1}
            eyebrow="Membership"
            headline={
              view.pendingPayment ? (
                "Almost there."
              ) : (
                <>
                  {view.tierMemberLabel}
                  <span className="mt-2 block text-lg font-normal text-foreground/55 sm:text-xl">
                    since {view.memberSinceFormatted}
                  </span>
                </>
              )
            }
            support={
              view.pendingPayment
                ? "Finish setting up your payment method to activate your membership."
                : undefined
            }
          >
            {view.pendingPayment && view.membershipId ? (
              <CardOnFileSetup
                memberName={data.homeowner.fullName}
                memberEmail={portalData?.profile.email}
                presentationId={view.presentationId ?? undefined}
                membershipId={view.membershipId}
                theme="presentation"
                onSuccess={handlePaymentSuccess}
              />
            ) : (
              <>
                <GlassCard tone="default" rim padding="md">
                  <MemberWalletCard
                    data={walletCard}
                    portalUrl={resolvedPortalPath}
                    foundingDisplay={view.foundingDisplay}
                    showActions={!isCustomerPortal}
                    embedded
                    entranceDelay={0}
                  />
                </GlassCard>
                {view.foundingDisplay && (
                  <div className="mt-6 flex justify-center">
                    <FoundingMemberHonor
                      display={view.foundingDisplay}
                      variant="hero"
                    />
                  </div>
                )}
                {view.foundingPrologue && (
                  <p className="founding-home-prologue mt-6 text-sm leading-relaxed text-amber-100/75">
                    {view.foundingPrologue}
                  </p>
                )}
                <div className="mt-5">
                  <ExpandLink
                    open={membershipOpen}
                    onClick={() => setMembershipOpen((v) => !v)}
                  />
                </div>
                {membershipOpen && (
                  <PortalCard className="mt-4 space-y-4">
                    {view.visitPriceLabel && (
                      <p className="text-sm text-foreground/90">
                        {view.visitPriceLabel}
                      </p>
                    )}
                    {view.annualMathLabel && (
                      <p className="text-sm text-foreground/60">
                        {view.annualMathLabel}
                      </p>
                    )}
                    {view.addonDiscountLabel && (
                      <p className="text-sm text-foreground/60">
                        {view.addonDiscountLabel}
                      </p>
                    )}
                    <ul className="space-y-3 border-t border-border pt-4">
                      {MEMBERSHIP_CLOSE_BILLING_BULLETS.map((bullet) => (
                        <CheckBullet key={bullet}>{bullet}</CheckBullet>
                      ))}
                    </ul>
                    <p className="text-xs leading-relaxed text-foreground/50">
                      {view.billingReminder}
                    </p>
                  </PortalCard>
                )}
              </>
            )}
          </PortalSection>

          {view.membershipActive && (
            <PortalSection
              id="savings"
              index={2}
              eyebrow="Member savings"
              headline="Your HomeAtlas savings."
              support="Real savings from membership visits and add-on services — tracked separately from referral Care Credits."
            >
              <HomeAtlasSavingsSection ledger={view.savingsLedger} />
            </PortalSection>
          )}

          {/* §2b — Referrals (members only, real data only) */}
          {view.membershipActive && resolvedPortalToken && (
            <ReferralSection
              portalToken={resolvedPortalToken}
              index={3}
            />
          )}

          {view.showHomeAtlasJourney && (
            <HomeAtlasJourneySection
              memberSince={view.memberSinceFormatted}
              membershipTier={view.membershipTierCareLabel}
              completedVisits={view.completedVisitCount}
              membershipSavings={view.membershipSavingsTotal}
            />
          )}

          {view.careAddons.length > 0 && (
            <PortalSection
              id="care-addons"
              index={4}
              eyebrow="Additional care"
              headline="Care add-ons."
              support="Extra services completed for your home as a member."
            >
              <CareAddonsSection addons={view.careAddons} />
            </PortalSection>
          )}

          {/* §4 — Agreement */}
          {showAgreement && view.agreement && (
            <PortalSection
              id="agreement"
              index={2}
              eyebrow="Documents"
              headline="Your agreement."
            >
              <PortalCard>
                <p className="font-serif text-lg text-foreground">
                  {view.agreement.planName}
                </p>
                <p className="mt-2 text-sm text-foreground/60">
                  Signed {view.agreement.signedAtFormatted}
                </p>
                {agreementPdfHref ? (
                  <a
                    href={agreementPdfHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-5 w-full ${craftPrimaryButton} !tracking-[0.1em]`}
                  >
                    View PDF
                  </a>
                ) : (
                  <>
                    <p className="mt-5 text-sm leading-relaxed text-foreground/60">
                      Your signed agreement is on file — we&apos;ll re-send your
                      copy.
                    </p>
                    <a
                      href={`mailto:agreements@squeegeeking.net?subject=${encodeURIComponent(`Agreement copy — ${view.propertyName}`)}`}
                      className={`mt-5 w-full ${craftSecondaryButton} !normal-case !tracking-[0.06em]`}
                    >
                      Request a copy
                    </a>
                  </>
                )}
              </PortalCard>
            </PortalSection>
          )}

          {/* §5 — Payment */}
          <PortalSection
            id="payment"
            index={3}
            eyebrow="Payment"
            headline={paymentHeadline}
            support={view.paymentSupport}
          >
            {view.paymentOnFile ? (
              <PortalCard className="space-y-4">
                <p className="text-sm text-foreground/70">
                  {view.paymentDetailLine} {view.billingReminder}
                </p>
                {view.showUpdatePaymentMethod && view.membershipId && (
                  <>
                    <button
                      type="button"
                      onClick={() => setUpdatePaymentOpen((open) => !open)}
                      className={`w-full ${craftSecondaryButton} !normal-case !tracking-[0.06em]`}
                    >
                      {updatePaymentOpen
                        ? "Cancel"
                        : "Update payment method"}
                    </button>
                    {updatePaymentOpen && (
                      <CardOnFileSetup
                        memberName={data.homeowner.fullName}
                        memberEmail={portalData?.profile.email}
                        presentationId={view.presentationId ?? undefined}
                        membershipId={view.membershipId}
                        theme="presentation"
                        onSuccess={handlePaymentSuccess}
                      />
                    )}
                  </>
                )}
              </PortalCard>
            ) : view.pendingPayment ? (
              <PortalCard>
                <p className="text-sm text-foreground/60">
                  Complete your payment setup in Membership above.
                </p>
              </PortalCard>
            ) : view.membershipId ? (
              <CardOnFileSetup
                memberName={data.homeowner.fullName}
                memberEmail={portalData?.profile.email}
                presentationId={view.presentationId ?? undefined}
                membershipId={view.membershipId}
                theme="presentation"
                onSuccess={handlePaymentSuccess}
              />
            ) : null}
          </PortalSection>

          {/* §3 — What's Next */}
          <PortalSection
            id="whats-next"
            index={4}
            eyebrow="What's next"
            headline={view.whatsNextHeadline}
            support={view.whatsNextSupport}
          >
            <p className="text-sm text-foreground/55">{view.cadenceNote}</p>
            <div className="mt-4">
              <ExpandLink
                open={whatsNextOpen}
                onClick={() => setWhatsNextOpen((v) => !v)}
              />
            </div>
            {whatsNextOpen && (
              <div className="mt-4">
                <ProcessTimeline />
              </div>
            )}
          </PortalSection>

          {/* §6 — Care Record */}
          <PortalSection
            id="care-record"
            index={5}
            eyebrow="Care record"
            headline={view.propertyName}
            support={view.propertyAddress}
          >
            <div className="craft-glass-subtle relative mb-8 overflow-hidden rounded-[var(--radius-card-lg)] shadow-[var(--shadow-float)]">
              {data.property.heroImage ? (
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src={data.property.heroImage}
                    alt={view.propertyName}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 640px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060606]/80 via-transparent to-transparent" />
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-b from-accent/[0.06] to-transparent py-10">
                  <AtlasMark size={104} className="mx-auto" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {view.propertyFacts.map((fact) => (
                <span
                  key={fact}
                  className="craft-glass-subtle rounded-full px-3.5 py-1.5 text-[11px] tracking-wide text-foreground/60 shadow-[var(--shadow-ambient)]"
                >
                  {fact}
                </span>
              ))}
            </div>
          </PortalSection>

          {/* §7 — Timeline */}
          <PortalSection
            id="timeline"
            index={6}
            eyebrow="Visit history"
            headline={view.storyHeadline}
          >
            {view.timelineEntries.length > 0 ? (
              <ul className="space-y-4">
                {view.timelineEntries.map((entry) => (
                  <li key={entry.id}>
                    <PortalCard>
                      <p className="font-serif text-lg text-foreground">
                        {entry.monthYear}
                      </p>
                      <p className="mt-2 flex items-start gap-2 text-sm text-foreground/70">
                        <span className="text-accent" aria-hidden>
                          ✓
                        </span>
                        {entry.label}
                      </p>
                      {entry.note && (
                        <p className="mt-2 text-sm text-foreground/50">
                          {entry.note}
                        </p>
                      )}
                    </PortalCard>
                  </li>
                ))}
              </ul>
            ) : (
              <PortalCard className="text-center">
                <p className="text-sm text-foreground/60">
                  {view.timelineEmptyCopy}
                </p>
              </PortalCard>
            )}
          </PortalSection>

          {/* §8 — Photos */}
          <PortalSection
            id="photos"
            index={7}
            eyebrow="Photos"
            headline={`${view.propertyName}, cared for.`}
          >
            {view.completedVisitCount > 0 ? (
              <PortalCard>
                <p className="text-sm text-foreground/60">
                  Photos from your visits appear here.
                </p>
              </PortalCard>
            ) : (
              <div className="craft-glass-subtle rounded-[var(--radius-card-lg)] border-accent/10 bg-gradient-to-b from-accent/[0.05] to-transparent py-12 text-center shadow-[var(--shadow-ambient)]">
                <AtlasMark size={104} className="mx-auto" />
                <p className="mx-auto mt-6 max-w-xs text-sm leading-relaxed text-foreground/60">
                  {view.photosEmptyCopy}
                </p>
              </div>
            )}
          </PortalSection>
        </div>

        {isCustomerPortal && (
          <div className="mt-16">
            <InstallHomeAtlas />
          </div>
        )}

        <footer className="mt-20 border-t border-border pt-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted/70">
            Powered by HomeAtlas
          </p>
        </footer>
      </div>
    </PortalStage>
  );
}
