import Link from "next/link";

export default function PaymentSetupCompletePage() {
  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-16 text-[#183126]">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-[#183126]/10 bg-white/75 p-8 shadow-[0_24px_80px_rgba(24,49,38,0.12)] backdrop-blur sm:p-12">
        <p className="text-xs uppercase tracking-[0.22em] text-[#557164]">
          HomeAtlas · SqueegeeKing
        </p>
        <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#183f2b] text-2xl text-white">
          ✓
        </div>
        <h1 className="mt-7 font-serif text-4xl font-light tracking-tight">
          Your card is securely saved.
        </h1>
        <p className="mt-5 text-base leading-7 text-[#557164]">
          Stripe has confirmed your setup. HomeAtlas is preparing your private
          home portal and will email your access link automatically.
        </p>
        <p className="mt-4 text-sm leading-6 text-[#6b7e74]">
          No payment was collected during this setup step. Future charges follow
          the service agreement you signed.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#183f2b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#23583d]"
        >
          Return to SqueegeeKing
        </Link>
      </section>
    </main>
  );
}
