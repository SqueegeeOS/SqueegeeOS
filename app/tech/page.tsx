import type { Metadata } from "next";
import { TechnicianTodayWorkspace } from "@/components/field/technician-today-workspace";

export const metadata: Metadata = {
  title: "Field Run | Technician",
};

export default function TechHomePage() {
  return <TechnicianTodayWorkspace />;
}
