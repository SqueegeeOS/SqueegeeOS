"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { HQ_SITE_BROWSE_LINKS } from "@/lib/navigation/hq-site-browse";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function HqSiteBrowseMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors",
          open
            ? "border-accent/40 bg-accent/10 text-foreground"
            : "border-foreground/15 bg-foreground/[0.04] text-muted hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground",
        )}
      >
        <span className="font-medium tracking-[0.01em]">Browse site</span>
        <span aria-hidden className="text-[10px] text-muted/80">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="menu"
          className="craft-glass-elevated absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-[15rem] overflow-hidden rounded-[1rem] py-2 shadow-[var(--shadow-lift)] sm:min-w-[18rem]"
        >
          <p className="px-4 pb-2 pt-1 text-[10px] uppercase tracking-[0.22em] text-muted/70">
            Surf the site
          </p>
          <ul className="max-h-[min(24rem,70vh)] overflow-y-auto">
            {HQ_SITE_BROWSE_LINKS.map((link) => (
              <li key={link.href} role="none">
                <Link
                  href={link.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 transition-colors hover:bg-foreground/[0.04]"
                >
                  <span className="block text-sm text-foreground">{link.label}</span>
                  {link.description ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      {link.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
