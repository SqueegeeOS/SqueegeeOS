"use client";

import Link from "next/link";
import { useCallback, useState, type CSSProperties } from "react";
import {
  CUSTOMER_PRIMARY_NAV,
  CUSTOMER_TAIL_NAV,
  CUSTOMER_BRAND_NAME,
  ROUTES,
} from "@/lib/navigation/config";
import {
  getMobileBackItem,
  isActiveNavItem,
  shouldUseOverlayNav,
} from "@/lib/navigation/resolve";
import { getNavigationSession } from "@/lib/navigation/session";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";
import { useNavScroll } from "./use-nav-scroll";
import { UserAccountMenu } from "./user-account-menu";

interface CustomerNavProps {
  pathname: string;
}

export function CustomerNav({ pathname }: CustomerNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useNavScroll(pathname);
  const immersive = shouldUseOverlayNav(pathname);
  const daylight = pathname === ROUTES.day2;
  const elevated = daylight || scrolled || !immersive;
  const lightText = !daylight && immersive && !scrolled;
  const session = getNavigationSession();
  const backItem = getMobileBackItem(pathname, "customer");
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  const headerSurface = daylight
    ? "border-[#173f32]/10 bg-[#fffaf0]/88 shadow-[0_8px_32px_rgba(23,63,50,0.12)] backdrop-blur-xl"
    : elevated
      ? lightText
        ? "border-accent/20 bg-black/55 shadow-[0_10px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl"
        : "border-accent/20 bg-background/82 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl"
      : "border-transparent bg-transparent";

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[60] border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out ${headerSurface}`}
        style={daylight ? ({
          height: "var(--site-nav-height)",
          "--background": "#fffaf0",
          "--foreground": "#173f32",
          "--muted": "#526b60",
          "--accent": "#99683d",
          "--border": "rgba(23,63,50,0.14)",
        } as CSSProperties) : { height: "var(--site-nav-height)" }}
      >
        <div className="relative z-[1] mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <Link
            href={ROUTES.home}
            className={`min-h-[44px] py-2 font-serif text-lg font-light tracking-[0.16em] transition-colors duration-300 hover:opacity-90 sm:text-xl ${
              lightText ? "text-white/92" : "text-foreground"
            }`}
          >
            {CUSTOMER_BRAND_NAME}
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
            {CUSTOMER_PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActiveNavItem(pathname, item.href)}
                light={lightText}
              />
            ))}

            {session ? (
              <UserAccountMenu session={session} light={lightText} />
            ) : null}

            {CUSTOMER_TAIL_NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActiveNavItem(pathname, item.href)}
                light={lightText}
              />
            ))}
          </nav>

          <button
            type="button"
            className={`relative z-[2] flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-300 touch-manipulation lg:hidden ${
              lightText
                ? "border-white/20 text-white/90 hover:border-white/35"
                : "border-border/80 text-foreground hover:border-accent/30"
            }`}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-site-menu"
            onClick={openMenu}
          >
            <span className="flex flex-col gap-1.5" aria-hidden>
              <span className="block h-px w-5 bg-current" />
              <span className="block h-px w-5 bg-current" />
            </span>
          </button>
        </div>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        pathname={pathname}
        items={[...CUSTOMER_PRIMARY_NAV, ...CUSTOMER_TAIL_NAV]}
        portalItem={null}
        accountSession={session}
        brandName={CUSTOMER_BRAND_NAME}
        brandHref={ROUTES.home}
        backItem={backItem}
        activePath={pathname}
        daylight={daylight}
      />
    </>
  );
}
