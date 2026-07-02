"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "./ui/primary-button";
import { useMembershipCheckout } from "@/components/membership/checkout-context";

export function MobileCtaBar({
  label,
}: {
  phone: string;
  label: string;
}) {
  const [visible, setVisible] = useState(false);
  const { openCheckout } = useMembershipCheckout();

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.85);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-500 ease-out md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <PrimaryButton type="button" onClick={openCheckout}>
        {label}
      </PrimaryButton>
    </div>
  );
}
