import Link from "next/link";

export default function PaymentSetupCancelledPage() {
  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-16 text-[#183126]">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-[#183126]/10 bg-white/75 p-8 shadow-[0_24px_80px_rgba(24,49,38,0.12)] backdrop-blur sm:p-12">
        <p className="text-xs uppercase tracking-[0.22em] text-[#557164]">
          HomeAtlas · SqueegeeKing
        </p>
        <h1 className="mt-8 font-serif text-4xl font-light tracking-tight">
          Nothing was saved or charged.
        </h1>
        <p className="mt-5 text-base leading-7 text-[#557164]">
          You safely left Stripe before completing card setup. Reopen the secure
          link in your email whenever you are ready, or reply to that email for
          help.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full border border-[#183f2b]/20 px-6 py-3 text-sm font-semibold text-[#183f2b] transition hover:bg-[#183f2b]/5"
        >
          Return to SqueegeeKing
        </Link>
      </section>
    </main>
  );
}
