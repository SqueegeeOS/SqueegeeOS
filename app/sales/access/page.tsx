import type { Metadata } from "next";
import Link from "next/link";
import { isSalesAccessToken } from "@/lib/sales/sales-access";
import {
  safeSalesReturnTo,
  salesWorkspacePath,
} from "@/lib/sales/sales-access-paths";

export const metadata: Metadata = {
  title: "Install Sales Phone Pass | HomeAtlas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SalesAccessPageProps {
  searchParams: Promise<{
    token?: string;
    rep?: string;
    returnTo?: string;
    error?: string;
  }>;
}

export default async function SalesAccessPage({
  searchParams,
}: SalesAccessPageProps) {
  const params = await searchParams;
  const token = isSalesAccessToken(params.token) ? params.token : null;
  const fallback = params.rep
    ? salesWorkspacePath(params.rep)
    : "/sales/access";
  const returnTo = safeSalesReturnTo(params.returnTo, fallback);
  const error = params.error === "claim-failed";
  const repLabel =
    params.rep?.trim().toLowerCase() === "david"
      ? "David's founding field desk"
      : "your private field desk";

  return (
    <main className="relative mx-auto flex min-h-[100svh] max-w-lg items-center overflow-hidden px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-x-8 top-10 h-72 rounded-full bg-emerald-300/10 blur-3xl"
        aria-hidden
      />
      <section className="relative w-full rounded-[1.75rem] border border-white/10 bg-[#0d1512] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.42)] sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9be2bd]">
            HomeAtlas · Phone Pass
          </p>
          <span className="rounded-full border border-[#9be2bd]/20 bg-[#9be2bd]/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#baf0d2]">
            Sales only
          </span>
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Install {repLabel}.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/58">
          Save this private workspace to the phone for doors, conversations,
          follow-ups, presentations, and signed memberships. It never opens
          founder billing, settings, other reps, or the full HQ.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-300/25 bg-red-300/[0.07] p-4 text-sm leading-relaxed text-red-100"
          >
            That one-time install link is invalid, expired, revoked, or already
            used. Ask HQ to create a new phone pass.
          </div>
        ) : null}

        {token ? (
          <form action="/api/sales/access/claim" method="post" className="mt-7">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className="min-h-14 w-full rounded-xl border border-[#a8ebc8]/50 bg-[#a8ebc8] px-5 text-sm font-semibold text-[#07110c] shadow-[0_16px_40px_rgba(105,214,157,0.18)] active:scale-[0.99]"
            >
              Install this phone pass
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-white/38">
              The link works once, then this device keeps a private 30-day
              session. HQ can revoke it instantly.
            </p>
          </form>
        ) : (
          <div className="mt-7 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm leading-relaxed text-amber-50">
            Open the one-time phone link created in HomeAtlas HQ. If the link
            was already installed, open the saved HomeAtlas icon instead.
          </div>
        )}

        <Link
          href="/hq"
          className="mt-6 inline-flex min-h-11 items-center text-xs text-white/40 hover:text-white/65"
        >
          Founder sign-in →
        </Link>
      </section>
    </main>
  );
}
