"use client";

import { useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { CustomerWorkspacePage } from "@/components/admin/customer-workspace-page";
import type { CustomerWorkspaceRefType } from "@/lib/hq/customer-workspace/types";
import { isAdminUnlocked } from "@/lib/admin/pin";

const TYPES: CustomerWorkspaceRefType[] = [
  "lead",
  "presentation",
  "property",
  "closed-job",
];

function isRefType(value: string): value is CustomerWorkspaceRefType {
  return TYPES.includes(value as CustomerWorkspaceRefType);
}

export function CustomerWorkspacePageShell({
  type,
  id,
}: {
  type: string;
  id: string;
}) {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!isRefType(type)) {
    return <p className="p-8 text-sm text-muted">Invalid customer workspace.</p>;
  }

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <CustomerWorkspacePage type={type} id={id} />;
}
