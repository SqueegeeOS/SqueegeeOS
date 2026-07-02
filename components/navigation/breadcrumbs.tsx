"use client";

import Link from "next/link";
import type { Breadcrumb } from "@/lib/navigation/resolve";

interface BreadcrumbsProps {
  items: Breadcrumb[];
  overlay?: boolean;
}

export function Breadcrumbs({ items, overlay = false }: BreadcrumbsProps) {
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="pointer-events-none fixed inset-x-0 top-[var(--site-nav-height)] z-[59] px-5 py-2 sm:px-8 lg:px-10"
    >
      <ol className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-0.5 font-serif text-[10px] font-light tracking-[0.12em] text-muted/55">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && (
                <span
                  className={overlay ? "text-white/25" : "text-muted/35"}
                  aria-hidden
                >
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={`transition-colors duration-300 touch-manipulation ${
                    overlay
                      ? "text-white/45 hover:text-white/70"
                      : "text-muted/60 hover:text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={overlay ? "text-white/60" : "text-muted/75"}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
