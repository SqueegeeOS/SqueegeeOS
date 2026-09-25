import Link from "next/link";
import { redirect } from "next/navigation";
import { repairRecordedNativeEnrollment } from "@/lib/enrollment/repair-recorded-native-enrollment";

export const dynamic = "force-dynamic";

export default async function EnrollmentStripeRetryPage({
  params,
}: {
  params: Promise<{ presentationId: string }>;
}) {
  const { presentationId } = await params;

  async function retryStripeHandoff() {
    "use server";
    await repairRecordedNativeEnrollment(presentationId);
    redirect("/hq/enrollment");
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16 text-white">
      <p className="text-xs uppercase tracking-[0.28em] text-white/50">
        HomeAtlas HQ
      </p>
      <h1 className="mt-3 font-serif text-4xl font-light">
        Retry Stripe card setup
      </h1>
      <p className="mt-5 leading-7 text-white/70">
        This uses the existing completed signature and membership. It creates a
        Stripe-hosted card-details link and emails that secure link to the
        customer. It does not charge the card.
      </p>
      <form action={retryStripeHandoff} className="mt-8">
        <button
          type="submit"
          className="rounded-full bg-white px-6 py-3 font-semibold text-black"
        >
          Generate and email Stripe link
        </button>
      </form>
      <Link
        href="/hq/enrollment"
        className="mt-6 inline-block text-sm text-white/60 underline"
      >
        Cancel
      </Link>
    </main>
  );
}
