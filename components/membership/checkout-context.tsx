"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";

interface MembershipCheckoutContextValue {
  isOpen: boolean;
  planData: HomeCarePlanData;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const MembershipCheckoutContext =
  createContext<MembershipCheckoutContextValue | null>(null);

export function MembershipCheckoutProvider({
  children,
  planData,
}: {
  children: ReactNode;
  planData: HomeCarePlanData;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const openCheckout = useCallback(() => setIsOpen(true), []);
  const closeCheckout = useCallback(() => setIsOpen(false), []);

  return (
    <MembershipCheckoutContext.Provider
      value={{ isOpen, planData, openCheckout, closeCheckout }}
    >
      {children}
    </MembershipCheckoutContext.Provider>
  );
}

export function useMembershipCheckout() {
  const ctx = useContext(MembershipCheckoutContext);
  if (!ctx) {
    throw new Error(
      "useMembershipCheckout must be used within MembershipCheckoutProvider",
    );
  }
  return ctx;
}
