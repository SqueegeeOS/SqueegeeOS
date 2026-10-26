import type { Metadata } from "next";

// Payment return screens are transactional, not search landing pages. Keep
// this at the segment boundary so new return routes cannot inherit index:true.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
