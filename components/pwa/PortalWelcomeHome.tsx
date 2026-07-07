"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { buildPortalAccessPath } from "@/lib/membership/portal-access";
import {
  isAndroidDevice,
  isBeforeInstallPromptEvent,
  isIosDevice,
  isPwaStandalone,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa/device";
import {
  hasSeenInstallWelcome,
  markInstallWelcomeSeen,
} from "@/lib/pwa/install-welcome";
import { storePortalAccessToken } from "@/lib/pwa/portal-session";

const easeLuxury = [0.16, 1, 0.3, 1] as const;

interface PortalWelcomeHomeProps {
  token: string;
}

export function PortalWelcomeHome({ token }: PortalWelcomeHomeProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const portalPath = buildPortalAccessPath(token);

  const enterPortal = useCallback(() => {
    markInstallWelcomeSeen();
    storePortalAccessToken(token);
    router.replace(portalPath);
  }, [router, portalPath, token]);

  useEffect(() => {
    if (isPwaStandalone() || hasSeenInstallWelcome()) {
      storePortalAccessToken(token);
      router.replace(portalPath);
      return;
    }
    setReady(true);
  }, [router, portalPath, token]);

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferredPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleAddToHomeScreen = useCallback(async () => {
    if (isAndroidDevice() && deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === "accepted") {
          enterPortal();
          return;
        }
      } catch {
        // fall through to hint or continue
      } finally {
        setInstalling(false);
      }
    }

    if (isIosDevice() || (!deferredPrompt && !isPwaStandalone())) {
      setIosHint(true);
    }
  }, [deferredPrompt, enterPortal]);

  if (!ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[#060606]">
        <div className="h-px w-12 animate-pulse bg-accent/40" aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#060606] px-6 py-12 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,184,150,0.08),transparent_62%)]"
        aria-hidden
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: easeLuxury }}
        className="relative z-10 w-full max-w-md"
      >
        <p className="text-[10px] uppercase tracking-[0.32em] text-accent/70">
          {PLATFORM_BRAND.name}
        </p>

        <h1 className="mt-6 font-serif text-4xl font-light tracking-tight text-[#f5f2eb] sm:text-5xl">
          Welcome Home.
        </h1>

        <p className="mt-5 text-base leading-relaxed text-white/55 sm:text-lg">
          Your home&apos;s care record is now ready.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/40">
          For the best experience, keep {PLATFORM_BRAND.name} one tap away.
        </p>

        {iosHint && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeLuxury }}
            className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8"
          >
            <HomeScreenIconPreview />
            <p className="mt-5 text-sm leading-relaxed text-white/50">
              Tap{" "}
              <span className="text-[#f5f2eb]">Share</span>
              {" "}in Safari, then{" "}
              <span className="text-[#f5f2eb]">Add to Home Screen</span>.
            </p>
          </motion.div>
        )}

        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={() => void handleAddToHomeScreen()}
            disabled={installing}
            className="flex w-full min-h-[52px] items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#e8d5a3] py-4 text-sm font-bold text-[#060606] transition disabled:opacity-50"
          >
            {installing ? "Adding…" : "Add to Home Screen"}
          </button>

          <button
            type="button"
            onClick={enterPortal}
            className="flex w-full min-h-[52px] items-center justify-center rounded-lg border border-white/20 py-4 text-sm font-medium text-[#f5f2eb] transition hover:border-white/35"
          >
            Continue to My Home
          </button>
        </div>

        <p className="mt-12 text-[10px] uppercase tracking-[0.3em] text-white/25">
          Powered by {PLATFORM_BRAND.name}
        </p>
      </motion.div>
    </div>
  );
}

function HomeScreenIconPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mx-auto flex w-full max-w-[200px] flex-col items-center gap-4">
      <div className="grid w-full grid-cols-4 gap-2 opacity-40" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-[18%] bg-white/10"
          />
        ))}
      </div>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: easeLuxury, delay: reduceMotion ? 0 : 0.15 }}
        className="flex flex-col items-center gap-2"
      >
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22%] border border-accent/30 bg-[#060606] shadow-[0_8px_32px_rgba(201,184,150,0.15)]">
          <span className="font-serif text-3xl font-light text-accent">H</span>
        </div>
        <span className="text-[10px] text-white/45">{PLATFORM_BRAND.name}</span>
      </motion.div>
    </div>
  );
}
