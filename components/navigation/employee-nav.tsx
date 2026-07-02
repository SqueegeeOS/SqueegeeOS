"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  EMPLOYEE_BRAND_NAME,
  EMPLOYEE_NAV_ITEMS,
  ROUTES,
} from "@/lib/navigation/config";
import { getMobileBackItem, isActiveNavItem } from "@/lib/navigation/resolve";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";

interface EmployeeNavProps {
  pathname: string;
}

export function EmployeeNav({ pathname }: EmployeeNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const backItem = getMobileBackItem(pathname, "employee");
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[60] border-b border-border/60 bg-background/90 backdrop-blur-xl"
        style={{ height: "var(--site-nav-height)" }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <Link
            href={ROUTES.employeeHome}
            className="flex min-h-[44px] items-center gap-3 py-2 transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated">
              <span className="font-serif text-sm font-light tracking-[0.18em] text-accent">
                S
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="font-serif text-base font-light tracking-[0.14em] text-foreground">
                {EMPLOYEE_BRAND_NAME}
              </p>
              <p className="text-[9px] uppercase tracking-[0.32em] text-muted">
                Employee
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Employee">
            {EMPLOYEE_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActiveNavItem(pathname, item.href)}
              />
            ))}
          </nav>

          <button
            type="button"
            className="relative z-[2] flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-accent/30 touch-manipulation lg:hidden"
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
        items={EMPLOYEE_NAV_ITEMS}
        brandName={EMPLOYEE_BRAND_NAME}
        brandHref={ROUTES.employeeHome}
        backItem={backItem}
        activePath={pathname}
      />
    </>
  );
}
