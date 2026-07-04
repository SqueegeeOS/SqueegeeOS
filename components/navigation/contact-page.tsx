"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { MEMBER_ADD_ON_CATALOG } from "@/lib/membership/member-portal-status";
import { ROUTES } from "@/lib/navigation/config";
import { AmbientGlow, Eyebrow, Reveal, easeLuxury } from "@/components/marketing/ui";

interface ContactPageContentProps {
  phone: string;
  topic?: string | null;
  propertySlug?: string | null;
  serviceId?: string | null;
}

function contactCopy(topic?: string | null, serviceId?: string | null) {
  const addon = serviceId
    ? MEMBER_ADD_ON_CATALOG.find((item) => item.id === serviceId)
    : undefined;

  if (topic === "schedule-visit") {
    return {
      eyebrow: "Schedule a Visit",
      title: "Let's find a time for your home.",
      body: "Call or text us with a few windows that work for you. As a member, your visit is prioritized on our calendar.",
    };
  }

  if (topic === "add-on" && addon) {
    return {
      eyebrow: "Member Add-On",
      title: `Request ${addon.name}.`,
      body: `Reach us to add ${addon.name.toLowerCase()} to your property care. Member pricing applies automatically for eligible plans.`,
    };
  }

  if (topic === "add-on") {
    return {
      eyebrow: "Member Add-On",
      title: "Request an add-on service.",
      body: "Call or text us to schedule extra care between visits. Member pricing applies for quarterly and bi-annual plans.",
    };
  }

  return {
    eyebrow: "Contact",
    title: "We are here for your home.",
    body: `${CUSTOMER_BRAND.name} serves homeowners in ${CUSTOMER_BRAND.location} with calm, consistent care. Reach us directly — or begin with a Home Care Plan request.`,
  };
}

export function ContactPageContent({
  phone,
  topic,
  propertySlug,
  serviceId,
}: ContactPageContentProps) {
  const reduceMotion = useReducedMotion();
  const phoneHref = `tel:${phone.replace(/\D/g, "")}`;
  const copy = contactCopy(topic, serviceId);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-background"
      style={{ paddingTop: "var(--site-chrome-offset)" }}
    >
      <AmbientGlow />

      <div className="relative mx-auto max-w-xl px-5 py-16 sm:px-0 sm:py-24">
        <Reveal>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h1 className="mt-6 font-serif text-4xl font-light leading-tight text-foreground sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">{copy.body}</p>
          {propertySlug ? (
            <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-muted/80">
              Property reference · {propertySlug.replace(/-/g, " ")}
            </p>
          ) : null}
        </Reveal>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.15, ease: easeLuxury }}
          className="mt-12 space-y-4"
        >
          <a
            href={phoneHref}
            className="flex min-h-[60px] flex-col justify-center rounded-2xl border border-border bg-surface px-6 py-5 transition-colors hover:border-accent/30"
          >
            <span className="text-[10px] uppercase tracking-[0.26em] text-accent">
              Phone
            </span>
            <span className="mt-2 font-serif text-2xl font-light text-foreground">
              {phone}
            </span>
          </a>

          <Link
            href={ROUTES.request}
            className="flex min-h-[60px] items-center justify-between rounded-2xl border border-border bg-surface px-6 py-5 transition-colors hover:border-accent/30"
          >
            <div>
              <span className="text-[10px] uppercase tracking-[0.26em] text-accent">
                New homeowners
              </span>
              <p className="mt-2 font-serif text-xl font-light text-foreground">
                Request a Home Care Plan
              </p>
            </div>
            <span className="text-muted">→</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
