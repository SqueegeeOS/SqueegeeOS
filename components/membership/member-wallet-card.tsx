"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useState } from "react";
import type { MemberWalletCardData } from "@/lib/membership/member-wallet-card-data";
import {
  renderMemberWalletCardPng,
  walletCardFileName,
} from "@/lib/membership/render-wallet-card-image";
import type { FoundingMemberDisplay } from "@/lib/membership/founding-member";
import { MemberAddonDiscountStamp } from "./member-addon-discount-stamp";
import { MembershipActiveBadge } from "./membership-active-badge";
import { FoundingMemberHonor } from "./founding-member-honor";

const easeLuxury = [0.16, 1, 0.3, 1] as const;

interface MemberWalletCardProps {
  data: MemberWalletCardData;
  portalUrl: string;
  foundingDisplay?: FoundingMemberDisplay | null;
  entranceDelay?: number;
  showActions?: boolean;
  embedded?: boolean;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function MemberWalletCard({
  data,
  portalUrl,
  foundingDisplay = null,
  entranceDelay = 0.3,
  showActions = true,
  embedded = false,
}: MemberWalletCardProps) {
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runExport = useCallback(async () => {
    return renderMemberWalletCardPng(data);
  }, [data]);

  const handleSave = useCallback(async () => {
    setBusy("save");
    setFeedback(null);
    try {
      const blob = await runExport();
      const file = new File([blob], walletCardFileName(data.memberName), {
        type: "image/png",
      });

      if (
        isMobileDevice() &&
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          title: `${data.memberName} — ${data.brandName}`,
          text: `${data.tierLabel} · ${data.addonDiscountLabel ?? "Member"}`,
          files: [file],
        });
        setFeedback("Card shared — save to Photos from the share sheet.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = walletCardFileName(data.memberName);
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback("Card saved to your downloads.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback("Could not save the card. Try Share instead.");
    } finally {
      setBusy(null);
    }
  }, [data, runExport]);

  const handleShare = useCallback(async () => {
    setBusy("share");
    setFeedback(null);
    try {
      const blob = await runExport();
      const file = new File([blob], walletCardFileName(data.memberName), {
        type: "image/png",
      });

      const shareUrl = portalUrl.startsWith("http")
        ? portalUrl
        : `${window.location.origin}${portalUrl}`;

      const sharePayload: ShareData = {
        title: `${data.memberName} — ${data.brandName} Member`,
        text: `${data.tierLabel}${data.addonDiscountLabel ? ` · ${data.addonDiscountLabel}` : ""}`,
        url: shareUrl,
      };

      if (
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ ...sharePayload, files: [file] });
        return;
      }

      if (typeof navigator.share === "function") {
        await navigator.share(sharePayload);
        return;
      }

      if (navigator.clipboard?.writeText) {
        const shareUrl = portalUrl.startsWith("http")
          ? portalUrl
          : `${window.location.origin}${portalUrl}`;
        await navigator.clipboard.writeText(shareUrl);
        setFeedback("Portal link copied to clipboard.");
        return;
      }

      setFeedback("Sharing is not available in this browser.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback("Could not share. Try Save to Phone.");
    } finally {
      setBusy(null);
    }
  }, [data, portalUrl, runExport]);

  const card = (
    <>
      <article
        className="relative mx-auto max-w-[358px] overflow-hidden rounded-[1.35rem] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
        style={{
          aspectRatio: foundingDisplay ? "358 / 252" : "358 / 220",
        }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#1c1914] via-[#0a0a0a] to-[#12100c]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-accent/12 via-transparent to-transparent"
          aria-hidden
        />
        {foundingDisplay && (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent"
            aria-hidden
          />
        )}

        <div className="relative flex h-full flex-col p-4 sm:p-5">
          <div className="flex shrink-0 items-start justify-between gap-x-3">
            <p className="min-w-0 text-[11px] font-medium tracking-[0.2em] text-accent">
              ✦ {data.brandName}
            </p>
            <div className="flex shrink-0 items-start justify-end gap-2">
              {data.addonDiscountPercent != null && (
                <MemberAddonDiscountStamp
                  discountPercent={data.addonDiscountPercent}
                />
              )}
              {data.isActive && <MembershipActiveBadge variant="inline" />}
            </div>
          </div>

          <div className="min-h-0 flex-1 pt-1">
            <p className="font-serif text-[1.45rem] font-light leading-[1.02] text-[#f5f2eb] sm:text-[1.55rem]">
              {data.memberName}
            </p>
            <p className="mt-0.5 text-sm tracking-[0.06em] text-accent">
              {data.tierLabel}
            </p>
            {foundingDisplay && (
              <div className="mt-1.5 max-w-[70%]">
                <FoundingMemberHonor display={foundingDisplay} variant="card" />
              </div>
            )}
            {!foundingDisplay && data.addonDiscountLabel && (
              <p className="mt-2 text-[11px] font-medium leading-snug text-white/80">
                {data.addonDiscountLabel}
              </p>
            )}
            {!foundingDisplay && (
              <p className="mt-1 text-[11px] text-white/45">{data.memberSinceLabel}</p>
            )}
          </div>

          <div
            className="mt-auto shrink-0 flex items-end gap-[3px] border-t border-accent/15 pt-1.5"
            aria-hidden
          >
              {Array.from({ length: 24 }).map((_, index) => (
                <span
                  key={index}
                  className={`w-[3px] rounded-sm ${
                    index % 2 === 0 ? "bg-accent/40" : "bg-foreground/25"
                  }`}
                  style={{ height: `${6 + (index % 3) * 3}px` }}
                />
              ))}
          </div>
        </div>
      </article>

      {showActions && (
      <div className="mx-auto mt-5 flex max-w-[358px] flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={busy !== null}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-border bg-surface px-5 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground transition-colors hover:border-accent/35 disabled:opacity-50 touch-manipulation"
        >
          {busy === "share" ? "Sharing…" : "Share"}
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy !== null}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-accent px-5 text-[11px] font-medium uppercase tracking-[0.18em] text-background transition-opacity hover:opacity-90 disabled:opacity-50 touch-manipulation"
        >
          {busy === "save" ? "Saving…" : "Save to Phone"}
        </button>
      </div>
      )}

      {feedback && showActions && (
        <p className="mx-auto mt-3 max-w-[358px] text-center text-xs text-muted">
          {feedback}
        </p>
      )}
    </>
  );

  if (embedded) {
    return card;
  }

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.95,
        delay: reduceMotion ? 0 : entranceDelay,
        ease: easeLuxury,
      }}
      className="mt-10"
      aria-labelledby="member-wallet-card-heading"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
        Your membership
      </p>
      <h2 id="member-wallet-card-heading" className="sr-only">
        {data.memberName} — {data.tierLabel}
      </h2>
      <div className="mt-4">{card}</div>
    </motion.section>
  );
}
