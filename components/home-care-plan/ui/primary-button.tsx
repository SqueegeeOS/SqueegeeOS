"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { easePlan } from "./primitives";

type PrimaryButtonProps = HTMLMotionProps<"button"> & {
  children: ReactNode;
  fullWidth?: boolean;
};

type PrimaryLinkProps = HTMLMotionProps<"a"> & {
  children: ReactNode;
  href: string;
  fullWidth?: boolean;
};

const baseClassName =
  "relative flex min-h-[52px] items-center justify-center overflow-hidden rounded-full border border-accent/40 bg-accent px-8 py-4 text-sm font-medium tracking-[0.14em] text-background sm:min-h-[56px] sm:px-12 sm:text-base sm:tracking-[0.16em] touch-manipulation";

export function PrimaryButton({
  children,
  fullWidth = true,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25, ease: easePlan }}
      className={`group ${baseClassName} ${fullWidth ? "w-full sm:w-auto" : ""} ${className}`}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-transparent opacity-0 transition-opacity duration-700 group-active:opacity-100 sm:group-hover:opacity-100" />
      <span className="relative px-1">{children}</span>
    </motion.button>
  );
}

export function PrimaryLink({
  children,
  href,
  fullWidth = true,
  className = "",
  ...props
}: PrimaryLinkProps) {
  return (
    <motion.a
      href={href}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25, ease: easePlan }}
      className={`group ${baseClassName} ${fullWidth ? "w-full sm:inline-flex sm:w-auto" : "inline-flex"} ${className}`}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-transparent opacity-0 transition-opacity duration-700 group-active:opacity-100 sm:group-hover:opacity-100" />
      <span className="relative px-1">{children}</span>
    </motion.a>
  );
}
