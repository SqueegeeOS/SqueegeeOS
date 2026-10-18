import type { Metadata } from "next";
import { MarketingDesk } from "@/components/admin/marketing-desk";

export const metadata: Metadata = { title: "Marketing · Headquarters", robots: { index: false, follow: false } };
export default function MarketingPage() { return <MarketingDesk />; }
