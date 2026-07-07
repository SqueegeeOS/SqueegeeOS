"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  isAndroidDevice,
  isBeforeInstallPromptEvent,
  isIosDevice,
  isPwaStandalone,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa/device";
import { hasSeenInstallWelcome } from "@/lib/pwa/install-welcome";

const SESSION_DISMISS_KEY = "homeatlas:pwa-install-card-dismissed";

function wasCardDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markCardDismissedThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * In-portal install nudge for returning members who skipped the welcome ceremony.
 * Never shown if install welcome was completed or app is already installed.
 */
export function InstallHomeAtlas() {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (
      isPwaStandalone() ||
      hasSeenInstallWelcome() ||
      wasCardDismissedThisSession()
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!isPwaStandalone() && !hasSeenInstallWelcome()) {
        setVisible(true);
      }
    }, 2400);

    function onBeforeInstall(event: Event) {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferredPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const dismiss = useCallback(() => {
    markCardDismissedThisSession();
    setVisible(false);
  }, []);

  const handleAndroidInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      dismiss();
    } catch {
      // User cancelled or browser blocked — keep card visible.
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt, dismiss]);

  if (!visible || isPwaStandalone() || hasSeenInstallWelcome()) return null;

  const showAndroidCta = isAndroidDevice() && deferredPrompt;

  return (
    <motion.aside
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="mt-8 overflow-hidden rounded-2xl border border-accent/20 bg-surface/60 p-5 sm:p-6"
      aria-label="Install HomeAtlas"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-light text-foreground sm:text-xl">
            Keep your home&apos;s care record one tap away.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Add HomeAtlas to your Home Screen for the best experience.
          </p>

          {isIosDevice() && (
            <ol className="mt-4 space-y-2 text-sm text-muted">
              <li className="flex gap-2">
                <span className="text-accent">1.</span>
                <span>
                  Tap <strong className="font-medium text-foreground/80">Share</strong>{" "}
                  in Safari
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent">2.</span>
                <span>
                  Choose{" "}
                  <strong className="font-medium text-foreground/80">
                    Add to Home Screen
                  </strong>
                </span>
              </li>
            </ol>
          )}

          {showAndroidCta && (
            <button
              type="button"
              onClick={() => void handleAndroidInstall()}
              disabled={installing}
              className="mt-4 min-h-[44px] rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-background transition disabled:opacity-50"
            >
              {installing ? "Installing…" : "Install HomeAtlas"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full p-2 text-muted transition hover:text-foreground"
          aria-label="Dismiss install suggestion"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </motion.aside>
  );
}
