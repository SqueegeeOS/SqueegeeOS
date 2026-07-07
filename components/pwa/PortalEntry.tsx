"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { storePortalAccessToken } from "@/lib/pwa/portal-session";

/**
 * Persists the portal token when a member opens their magic link.
 * Enables PWA start_url (/portal) to resolve without changing URLs.
 */
export function PortalEntry() {
  const params = useParams();
  const token = params?.token;

  useEffect(() => {
    if (typeof token === "string" && token.trim()) {
      storePortalAccessToken(token);
    }
  }, [token]);

  return null;
}
