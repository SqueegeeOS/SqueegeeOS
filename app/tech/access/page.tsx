import type { Metadata } from "next";
import Link from "next/link";
import { isFieldAccessToken } from "@/lib/field-operations/field-access";

export const metadata: Metadata = {
  title: "Activate Technician Access | HomeAtlas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface FieldAccessPageProps {
  searchParams: Promise<{
    token?: string;
    returnTo?: string;
    error?: string;
  }>;
}

function safeReturnTo(value: string | undefined): string {
  return value?.startsWith("/tech") && !value.startsWith("/tech/access")
    ? value
    : "/tech";
}

export default async function FieldAccessPage({
  searchParams,
}: FieldAccessPageProps) {
  const params = await searchParams;
  const token = isFieldAccessToken(params.token) ? params.token : null;
  const returnTo = safeReturnTo(params.returnTo);
  const error = params.error === "claim-failed";

  return (
    <main className="mx-auto flex min-h-[100svh] max-w-lg items-center px-4 py-10">
      <section className="w-full rounded-[1.75rem] border border-white/10 bg-[#111615] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:p-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9be2bd]">
          HomeAtlas · Technician Access
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
          Your workday, without the clutter.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Technician Access opens only the stops assigned to you. Track time,
          review the service, add photos and notes, and close out the visit—never
          billing, customer messaging, sales tools, or owner controls.
        </p>

        {error ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-300/25 bg-red-300/[0.07] p-4 text-sm leading-relaxed text-red-100">
            That install link is invalid, expired, revoked, or already used. Ask
            HQ to create a new Technician Access link.
          </div>
        ) : null}

        {token ? (
          <form action="/api/field/access/claim" method="post" className="mt-7">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className="min-h-14 w-full rounded-xl border border-[#9be2bd]/50 bg-[#9be2bd] px-5 text-sm font-semibold text-[#07110c] shadow-[0_16px_40px_rgba(105,214,157,0.16)] active:scale-[0.99]"
            >
              Activate my workspace
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-white/35">
              One-time setup on this device. Access remains active while you are
              on the team, and HQ can remove it instantly.
            </p>
          </form>
        ) : (
          <div className="mt-7 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm leading-relaxed text-amber-100">
            Open the one-time link HQ created for your Jobber crew account. If
            you need a new link, ask HQ to open Team in HomeAtlas.
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
