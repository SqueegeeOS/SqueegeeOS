"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { NavigationSession } from "@/lib/navigation/session";

const menuEase = [0.22, 1, 0.36, 1] as const;

interface UserAccountMenuProps {
  session: NavigationSession;
  light?: boolean;
}

export function UserAccountMenu({ session, light = false }: UserAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex min-h-[34px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-all duration-300 touch-manipulation ${
          light
            ? "border-white/25 text-white/90 hover:border-accent/35"
            : "border-accent/30 text-foreground/90 hover:border-accent/45"
        }`}
      >
        <span className="max-w-[9rem] truncate font-light normal-case tracking-[0.04em]">
          {session.displayName}
        </span>
        <span
          className={`text-[9px] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: menuEase }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-border/80 bg-background/95 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl"
          >
            {session.menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:bg-accent/[0.05] hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-1.5 h-px bg-border/70" />
            <button
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.18em] text-muted/80 transition-colors hover:bg-accent/[0.05] hover:text-foreground"
            >
              {session.signOutLabel ?? "Sign Out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
