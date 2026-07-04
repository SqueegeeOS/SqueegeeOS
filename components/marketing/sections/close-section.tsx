"use client";

import Link from "next/link";
import { CUSTOMER_BRAND, CUSTOMER_CTAS } from "@/lib/brand/customer";
import { ScrollReveal } from "@/components/scroll-cinema/scroll-reveal";

export function CloseSection() {
  return (
    <section className="relative overflow-hidden border-t border-border px-5 py-28 text-center sm:py-36">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(201,184,150,0.12) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(201,184,150,0.08) 0%, transparent 40%)",
        }}
      />

      <ScrollReveal>
        <p className="font-serif text-3xl font-light text-foreground sm:text-4xl">
          Your home deserves this.
        </p>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
          Request your plan. We inspect your property. You receive a personalized
          experience — not a quote.
        </p>
        <div className="mt-10">
          <Link
            href="/request"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-accent/40 bg-accent px-10 text-sm font-medium tracking-[0.12em] text-background transition-opacity hover:opacity-95"
          >
            {CUSTOMER_CTAS.requestPlan}
          </Link>
        </div>
      </ScrollReveal>

      <footer className="relative mt-24 border-t border-border pt-14 text-sm text-muted">
        <p className="font-serif text-lg text-foreground">{CUSTOMER_BRAND.name}</p>
        <p className="mt-2">
          {CUSTOMER_BRAND.tagline} · {CUSTOMER_BRAND.location}
        </p>
        <Link
          href="/employee"
          className="mt-8 inline-block min-h-[44px] py-2 text-[10px] uppercase tracking-[0.28em] text-muted/50 transition-colors hover:text-muted"
        >
          Team Login
        </Link>
      </footer>
    </section>
  );
}
