import type { Metadata } from "next";
import { AccessFrame } from "@/components/craft/access-frame";
import { StatusNotice } from "@/components/craft/status-notice";
import { craftPrimaryButton } from "@/lib/craft/tokens";
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
    <AccessFrame
      eyebrow="HomeAtlas · Phone Pass"
      badge="Sales only"
      title={`Install ${repLabel}.`}
      detail="Save this private workspace to the phone for doors, conversations, follow-ups, presentations, and signed memberships. It never opens founder billing, settings, other reps, or the full HQ."
    >
        {error ? (
          <StatusNotice tone="danger" className="mt-6">
            That one-time install link is invalid, expired, revoked, or already
            used. Ask HQ to create a new phone pass.
          </StatusNotice>
        ) : null}

        {token ? (
          <form action="/api/sales/access/claim" method="post" className="mt-7">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className={`w-full ${craftPrimaryButton}`}
            >
              Install this phone pass
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-foreground/45">
              The link works once, then this device keeps a private 30-day
              session. HQ can revoke it instantly.
            </p>
          </form>
        ) : (
          <StatusNotice tone="warning" className="mt-7">
            Open the one-time phone link created in HomeAtlas HQ. If the link
            was already installed, open the saved HomeAtlas icon instead.
          </StatusNotice>
        )}
    </AccessFrame>
  );
}
