"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { buildSalesPhoneInstallQrDataUrl } from "@/lib/sales/phone-install-qr";

function subscribeToStaticCapability() {
  return () => undefined;
}

function readShareAvailability() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function readServerShareAvailability() {
  return false;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "the displayed expiration time";
}

export function SalesPhoneInstallHandoff({
  displayName,
  installUrl,
  inviteExpiresAt,
}: {
  displayName: string;
  installUrl: string;
  inviteExpiresAt: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const shareAvailable = useSyncExternalStore(
    subscribeToStaticCapability,
    readShareAvailability,
    readServerShareAvailability,
  );

  useEffect(() => {
    let active = true;

    void buildSalesPhoneInstallQrDataUrl(installUrl)
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrError(true);
      });
    return () => {
      active = false;
    };
  }, [installUrl]);

  async function copyInstallLink() {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function shareInstallLink() {
    if (!shareAvailable) return;
    try {
      await navigator.share({
        title: `${displayName}'s HomeAtlas field desk`,
        text: `Open this private one-time link on ${displayName}'s phone to install the HomeAtlas field desk.`,
        url: installUrl,
      });
      setShared(true);
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      ) {
        return;
      }
      setShared(false);
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.06] p-4 sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex min-h-56 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#f4f1e8] p-3 lg:h-64 lg:w-64">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={`Scan to install ${displayName}'s private HomeAtlas field desk`}
              width={224}
              height={224}
              unoptimized
              className="h-52 w-52 rounded-lg lg:h-56 lg:w-56"
            />
          ) : qrError ? (
            <p className="max-w-40 text-center text-xs leading-5 text-[#26352d]">
              The scan code could not render. Copy or share the private link
              instead.
            </p>
          ) : (
            <div className="h-20 w-20 animate-pulse rounded-2xl bg-[#ced8d0]" aria-label="Building private scan code" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.17em] text-emerald-200/75">
            {displayName}&apos;s one-time phone handoff
          </p>
          <h3 className="mt-2 font-serif text-2xl text-[#f5f2eb]">
            Scan. Install. Start the first door.
          </h3>
          <ol className="mt-4 space-y-2 text-sm leading-6 text-white/58">
            <li><span className="font-semibold text-emerald-100">1.</span> Scan this code with the rep&apos;s phone camera.</li>
            <li><span className="font-semibold text-emerald-100">2.</span> Tap <strong className="font-semibold text-white/80">Install this phone pass</strong>.</li>
            <li><span className="font-semibold text-emerald-100">3.</span> Inside the field desk, tap <strong className="font-semibold text-white/80">Install</strong> to save it to the Home Screen.</li>
          </ol>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyInstallLink()}
              className="min-h-12 rounded-xl bg-emerald-200 px-5 text-xs font-semibold text-[#07110c]"
            >
              {copied ? "Link copied" : "Copy private link"}
            </button>
            {shareAvailable ? (
              <button
                type="button"
                onClick={() => void shareInstallLink()}
                className="min-h-12 rounded-xl border border-emerald-200/30 bg-black/15 px-5 text-xs font-semibold text-emerald-100"
              >
                {shared ? "Share opened" : "Share to phone"}
              </button>
            ) : null}
          </div>

          <details className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.13em] text-white/48">
              Manual-link fallback
            </summary>
            <input
              readOnly
              value={installUrl}
              aria-label="One-time sales phone install link"
              className="mt-3 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-white/72 outline-none"
              onFocus={(event) => event.currentTarget.select()}
            />
          </details>

          <p className="mt-4 text-xs leading-5 text-white/42">
            Use it before {formatDateTime(inviteExpiresAt)}. The code is made
            locally inside HQ—no QR website receives the private link. It works
            once and HQ can revoke the installed session.
          </p>
        </div>
      </div>
    </div>
  );
}
