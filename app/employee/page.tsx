import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Employee Dashboard | SqueegeeOS",
};

export default function EmployeePage() {
  return <Dashboard />;
}
