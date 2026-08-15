import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment | SqueegeeKing",
  robots: { index: false, follow: false },
};

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const statusValue = (await searchParams).status;
  const status = Array.isArray(statusValue) ? statusValue[0] : statusValue;
  const complete = status === "success";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07100c] px-5 py-16 text-[#eff8f2]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(87,201,139,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_45%)]"
        aria-hidden
      />
      <section className="relative w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200/25 bg-emerald-200/10 text-2xl">
          {complete ? "✓" : "↗"}
        </div>
        <p className="mt-6 text-[10px] uppercase tracking-[0.32em] text-emerald-200/70">
          SqueegeeKing · HomeAtlas
        </p>
        <h1 className="mt-3 font-serif text-4xl font-light sm:text-5xl">
          {complete ? "Payment received." : "Payment not completed."}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-white/60">
          {complete
            ? "Thank you. Stripe is confirming the payment with HomeAtlas, and your service record will update automatically. Your receipt comes from Stripe."
            : "Nothing was charged. You can return to the secure payment link when you are ready, or contact us if the service details need to change."}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-200 px-6 text-sm font-semibold text-[#07100c] transition hover:bg-emerald-100"
          >
            Visit SqueegeeKing
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm text-white/75 transition hover:border-white/30 hover:text-white"
          >
            Contact the team
          </Link>
        </div>
      </section>
    </main>
  );
}
