"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/tech", label: "Today", glyph: "01" },
  { href: "/tech/refer", label: "Refer", glyph: "+" },
] as const;

export function TechnicianPortalDock() {
  const pathname = usePathname();
  if (pathname === "/tech/access") return null;

  return (
    <nav
      aria-label="Technician workspace"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg border-t border-[var(--border-strong)] bg-background/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-2 shadow-[0_-16px_42px_rgba(0,0,0,0.2)] backdrop-blur-xl"
    >
      <ul className="grid grid-cols-2 gap-2">
        {destinations.map((destination) => {
          const active = destination.href === "/tech"
            ? pathname === destination.href
            : pathname.startsWith(destination.href);
          return (
            <li key={destination.href}>
              <Link
                href={destination.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center rounded-2xl border text-[10px] uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? "border-accent/35 bg-accent/10 text-accent"
                    : "border-transparent text-foreground/45 active:bg-foreground/[0.05]"
                }`}
              >
                <span aria-hidden="true" className="mb-0.5 text-[11px] font-semibold tracking-normal">
                  {destination.glyph}
                </span>
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
