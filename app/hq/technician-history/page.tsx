import type { Metadata } from "next";
import { TechnicianHistory } from "@/components/admin/technician-history";

export const metadata: Metadata = { title: "Technician job history | HomeAtlas", robots: { index: false, follow: false } };
export default function TechnicianHistoryPage() { return <TechnicianHistory />; }
