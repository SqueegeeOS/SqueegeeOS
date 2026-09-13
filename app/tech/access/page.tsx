import type { Metadata } from "next";
import { AccessFrame } from "@/components/craft/access-frame";
import { StatusNotice } from "@/components/craft/status-notice";
import { craftPrimaryButton, craftSecondaryButton } from "@/lib/craft/tokens";
import { SQUEEGEEKING_PHONE_E164 } from "@/lib/marketing/local-seo";
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
    : "/tech/suite";
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
          <div className="mt-7 space-y-4">
            <StatusNotice tone="warning">
              Technician Access does not use a password. Ask HQ to open Team
              and tap <strong>Reconnect by text</strong> beside your name.
            </StatusNotice>
            <a
              href={`sms:${SQUEEGEEKING_PHONE_E164}?&body=${encodeURIComponent("I need a new HomeAtlas Technician Access link.")}`}
              className={`w-full ${craftSecondaryButton}`}
            >
              Text HQ for new access
            </a>
          </div>
        )}
    </AccessFrame>
  );
}
