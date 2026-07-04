import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { platformPageTitle } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: platformPageTitle("Employee Dashboard"),
};

export default function EmployeePage() {
  return <Dashboard />;
}
