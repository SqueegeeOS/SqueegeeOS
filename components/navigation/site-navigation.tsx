"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DIAMOND_CEREMONY_END,
  DIAMOND_CEREMONY_START,
} from "@/lib/membership/unlock-sequence";
import {
  getBreadcrumbs,
  getFloatingBack,
  getNavigationMode,
  shouldUseOverlayNav,
} from "@/lib/navigation/resolve";
import { Breadcrumbs } from "./breadcrumbs";
import { CustomerNav } from "./customer-nav";
import { EmployeeNav } from "./employee-nav";
import { FloatingBack } from "./floating-back";

export function SiteNavigation() {
  const pathname = usePathname() ?? "/";
  const [ceremonyActive, setCeremonyActive] = useState(false);
  const mode = getNavigationMode(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);
  const floatingBack = getFloatingBack(pathname);
  const overlay = shouldUseOverlayNav(pathname);
  const hasBreadcrumbs = breadcrumbs.length > 1;

  useEffect(() => {
    const onStart = () => setCeremonyActive(true);
    const onEnd = () => setCeremonyActive(false);
    window.addEventListener(DIAMOND_CEREMONY_START, onStart);
    window.addEventListener(DIAMOND_CEREMONY_END, onEnd);
    return () => {
      window.removeEventListener(DIAMOND_CEREMONY_START, onStart);
      window.removeEventListener(DIAMOND_CEREMONY_END, onEnd);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--site-breadcrumb-height",
      hasBreadcrumbs ? "1.75rem" : "0px",
    );
    document.documentElement.style.setProperty(
      "--site-chrome-offset",
      `calc(var(--site-nav-height) + ${hasBreadcrumbs ? "1.75rem" : "0px"})`,
    );
  }, [hasBreadcrumbs]);

  if (ceremonyActive) return null;

  return (
    <>
      {mode !== "hidden" &&
        (mode === "employee" ? (
          <EmployeeNav pathname={pathname} />
        ) : (
          <CustomerNav pathname={pathname} />
        ))}

      {mode !== "hidden" && hasBreadcrumbs && (
        <Breadcrumbs items={breadcrumbs} overlay={overlay && mode === "customer"} />
      )}

      {mode !== "hidden" && floatingBack && <FloatingBack config={floatingBack} />}
    </>
  );
}
