"use client";

import { MembershipActiveBadge } from "@/components/membership/membership-active-badge";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { NavItem } from "@/lib/navigation/config";
import type { NavigationSession } from "@/lib/navigation/session";
import { isActiveNavItem } from "@/lib/navigation/resolve";
import { NavLink } from "./nav-link";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  pathname: string;
  items: NavItem[];
  portalItem?: NavItem | null;
  accountSession?: NavigationSession | null;
  brandName: string;
  brandHref: string;
  backItem?: NavItem | null;
  activePath: string;
  daylight?: boolean;
}

export function MobileMenu({
  open,
  onClose,
  pathname,
  items,
  portalItem,
  accountSession,
  brandName,
  brandHref,
  backItem,
  activePath,
  daylight = false,
}: MobileMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  const previousPathname = useRef(pathname);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusFrame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialog)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    onCloseRef.current();
  }, [pathname]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] isolate pointer-events-auto"
      data-mobile-menu-root
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close menu"
        className={`absolute inset-0 backdrop-blur-md transition-opacity duration-300 ease-out motion-reduce:transition-none ${daylight ? "bg-[#173f32]/10" : "bg-black/25"} ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        ref={dialogRef}
        id="mobile-site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        tabIndex={-1}
        className={`absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col border-l px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${daylight ? "border-[#173f32]/15 bg-[#fffaf0]/95 shadow-[-8px_0_40px_rgba(23,63,50,0.16)]" : "border-border/60 bg-background/95 shadow-[-8px_0_40px_rgba(0,0,0,0.2)]"} ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        style={daylight ? ({
          "--background": "#fffaf0",
          "--foreground": "#173f32",
          "--muted": "#526b60",
          "--accent": "#99683d",
          "--border": "rgba(23,63,50,0.14)",
        } as CSSProperties) : undefined}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-5">
          <p className="font-serif text-lg font-light tracking-[0.12em] text-foreground/90">
            {brandName}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/80 text-muted transition-colors hover:border-accent/25 hover:text-foreground touch-manipulation"
            aria-label="Close navigation"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
          <NavLink
            href={brandHref}
            label="Home"
            mobile
            active={activePath === brandHref}
            onClick={onClose}
          />

          {backItem && (
            <NavLink
              href={backItem.href}
              label={`← ${backItem.label}`}
              mobile
              onClick={onClose}
            />
          )}

          <div className="my-3 h-px bg-border/50" />

          {items
            .filter((item) => item.href !== brandHref)
            .map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                mobile
                active={isActiveNavItem(activePath, item.href)}
                onClick={onClose}
              />
            ))}

          {portalItem && (
            <div className="mt-3 px-1">
              <Link
                href={portalItem.href}
                onClick={onClose}
                aria-current={
                  isActiveNavItem(activePath, portalItem.href) ? "page" : undefined
                }
                className={`flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-full border text-[10px] uppercase tracking-[0.2em] transition-all duration-300 touch-manipulation ${
                  isActiveNavItem(activePath, portalItem.href)
                    ? "border-accent/45 bg-accent/[0.06] text-accent"
                    : "border-accent/30 text-accent/85 hover:border-accent/45"
                }`}
              >
                <span>{portalItem.label}</span>
                <MembershipActiveBadge variant="navLight" className="py-0.5" />
              </Link>
            </div>
          )}

          {accountSession && (
            <div className="mt-4 space-y-1 border-t border-border/50 pt-4">
              <p className="px-4 pb-2 font-serif text-base font-light text-foreground/90">
                {accountSession.displayName}
              </p>
              {accountSession.menuItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  mobile
                  onClick={onClose}
                />
              ))}
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[52px] w-full items-center rounded-2xl px-4 text-[15px] font-light text-muted/80 transition-colors hover:bg-white/[0.03] hover:text-foreground touch-manipulation"
              >
                {accountSession.signOutLabel ?? "Sign Out"}
              </button>
            </div>
          )}
        </nav>
      </aside>
    </div>,
    document.body,
  );
}
