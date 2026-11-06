"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { buildPortalAccessPath } from "@/lib/membership/portal-access";
import { readStoredPortalToken } from "@/lib/pwa/portal-session";
import { PortalLoadingScreen } from "@/components/portal/portal-loading-screen";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { CUSTOMER_BRAND, CUSTOMER_CONTACT } from "@/lib/brand/customer";

/**
 * PWA start_url — resolves stored portal token to the member's private portal.
 * Future auth layers can replace storage lookup without changing this URL.
 */
export default function PortalEntryPage() {
  const router = useRouter();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const token = readStoredPortalToken();
    if (token) {
      router.replace(buildPortalAccessPath(token));
    } else {
      setResolved(true);
    }
  }, [router]);

  if (!resolved) {
    return <PortalLoadingScreen />;
  }

  return (
    <div className="customer-theme">
      <div className="flex min-h-[100svh] flex-col items-center justify-center bg-background px-5 py-12 text-foreground sm:px-8">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`${CUSTOMER_BRAND.name} home`}
        >
          <AtlasMark size={44} />
          <span>
            <span className="block font-serif text-2xl leading-tight">
              {CUSTOMER_BRAND.name}
            </span>
            <span className="mt-1 block text-xs text-muted">
              With {PLATFORM_BRAND.name}
            </span>
          </span>
        </Link>
        <section className="customer-panel w-full max-w-xl px-6 py-8 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Your private home care record
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            Open your portal link
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted">
            Use the private link from your welcome email to see your next visit,
            service history and Home Care Plan. Once opened, you can add {PLATFORM_BRAND.name} to your Home Screen.
          </p>
          <div className="mt-7 rounded-2xl border border-border bg-background p-5">
            <h2 className="text-base font-medium text-foreground">
              Can&apos;t find your link?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Check your welcome email from {CUSTOMER_BRAND.name}, or contact our
              team for help getting back to your home&apos;s record.
            </p>
            <Link href="/contact" className="customer-button-primary mt-5 w-full">
              Get portal help
            </Link>
            <a
              href={CUSTOMER_CONTACT.phoneHref}
              className="mt-3 flex min-h-11 items-center justify-center rounded-lg text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Call {CUSTOMER_CONTACT.phoneDisplay}
            </a>
          </div>
          <Link href="/" className="customer-button-secondary mt-6 w-full">
            Back to SqueegeeKing
          </Link>
        </section>
      </div>
    </div>
  );
}
