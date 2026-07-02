"use client";

import Link from "next/link";

interface NavLinkProps {
  href: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  mobile?: boolean;
  light?: boolean;
  variant?: "default" | "portal";
}

export function NavLink({
  href,
  label,
  active = false,
  onClick,
  className = "",
  mobile = false,
  light = false,
  variant = "default",
}: NavLinkProps) {
  if (variant === "portal" && !mobile) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-[34px] items-center rounded-full border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 touch-manipulation ${
          active
            ? "border-accent/45 bg-accent/[0.06] text-accent shadow-[0_0_20px_rgba(201,184,150,0.12)]"
            : light
              ? "border-white/25 text-white/85 hover:border-accent/35 hover:bg-white/5 hover:text-white"
              : "border-accent/30 text-accent/85 hover:border-accent/45 hover:bg-accent/[0.04]"
        } ${className}`}
      >
        {label}
      </Link>
    );
  }

  const base = mobile
    ? "relative flex min-h-[52px] items-center rounded-2xl px-4 text-[15px] font-light tracking-[0.02em] transition-colors duration-300 touch-manipulation"
    : "relative py-1 text-[11px] uppercase tracking-[0.22em] transition-colors duration-300";

  const state = active
    ? mobile
      ? light
        ? "text-white/95"
        : "text-foreground/95"
      : light
        ? "text-white/90"
        : "text-foreground/90"
    : mobile
      ? light
        ? "text-white/70 hover:bg-white/5 hover:text-white/90"
        : "text-muted hover:bg-white/[0.03] hover:text-foreground"
      : light
        ? "text-white/55 hover:text-white/85"
        : "text-muted/90 hover:text-foreground/85";

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${base} ${state} ${className}`}
    >
      {label}
      {active && (
        <span
          className={`absolute ${mobile ? "left-4 right-4 bottom-3" : "-bottom-1 left-0 right-0"} h-px ${
            light ? "bg-accent/50 shadow-[0_0_10px_rgba(201,184,150,0.25)]" : "bg-accent/45 shadow-[0_0_8px_rgba(201,184,150,0.2)]"
          }`}
          aria-hidden
        />
      )}
    </Link>
  );
}
