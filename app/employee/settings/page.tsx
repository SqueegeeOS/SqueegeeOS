import type { Metadata } from "next";
import { EmployeePlaceholderPage } from "@/components/navigation/employee-placeholder-page";
import { platformPageTitle } from "@/lib/brand/platform";

export const metadata: Metadata = {
  title: platformPageTitle("Settings"),
  description: "Employee preferences and platform settings.",
};

export default function EmployeeSettingsPage() {
  return (
    <EmployeePlaceholderPage
      eyebrow="Settings"
      title="Platform settings"
      description="Team preferences, notifications, and integrations will live here. The essentials are being prepared with the same care we bring to every home."
    />
  );
}
