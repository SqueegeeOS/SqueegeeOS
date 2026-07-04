const SERVICE_TYPE_LABELS: Record<string, string> = {
  exterior_windows: "Exterior Window Cleaning",
  interior_windows: "Interior Window Cleaning",
  pressure_wash: "Full Exterior Pressure Wash",
  concrete_clean: "Concrete & Driveway Clean",
  gutter_clean: "Gutter Cleaning",
  screen_track: "Screen & Track Detailing",
};

export function formatServiceTypeLabel(serviceType: string): string {
  return SERVICE_TYPE_LABELS[serviceType] ?? serviceType.replace(/_/g, " ");
}
