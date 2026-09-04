import type { Metadata } from "next";
import { AccessFrame } from "@/components/craft/access-frame";
import { StatusNotice } from "@/components/craft/status-notice";
import { craftPrimaryButton } from "@/lib/craft/tokens";
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
    <AccessFrame
      eyebrow="HomeAtlas · Technician Access"
      badge="Field only"
      title="Your workday, without the clutter."
      detail="Technician Access opens only your work. Track time, review assigned stops, add photos and notes, close out visits, and send warm referrals to HQ—never billing, customer messaging, or owner controls."
    >
        {error ? (
          <StatusNotice tone="danger" className="mt-6">
            That install link is invalid, expired, revoked, or already used. Ask
            HQ to create a new Technician Access link.
          </StatusNotice>
        ) : null}

        {token ? (
          <form action="/api/field/access/claim" method="post" className="mt-7">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className={`w-full ${craftPrimaryButton}`}
            >
              Activate my workspace
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-foreground/45">
              One-time setup on this device. Access remains active while you are
              on the team, and HQ can remove it instantly.
            </p>
          </form>
        ) : (
          <StatusNotice tone="warning" className="mt-7">
            Open the one-time link HQ created for your technician profile. If
            you need a new link, ask HQ to open Team in HomeAtlas.
          </StatusNotice>
        )}
    </AccessFrame>
  );
}
