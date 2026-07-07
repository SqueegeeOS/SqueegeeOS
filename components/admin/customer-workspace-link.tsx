"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CustomerWorkspaceRefType } from "@/lib/hq/customer-workspace/types";
import { customerWorkspaceHref } from "@/lib/hq/customer-workspace/routes";

export function CustomerWorkspaceLink({
  type,
  id,
  children,
  className,
  onClick,
}: {
  type: CustomerWorkspaceRefType;
  id: string;
  children: ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={customerWorkspaceHref(type, id)}
      className={
        className ??
        "font-medium text-foreground underline-offset-2 transition hover:text-accent hover:underline"
      }
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
