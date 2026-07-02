export const sampleHomeCarePlanPath =
  "/homecare/larry-buckley/canyon-oaks-residence/plan";

export const serviceOptions = [
  "Window Cleaning",
  "Gutter Cleaning",
  "Pressure Washing",
  "Solar Panel Cleaning",
  "Exterior Home Care",
  "Full Home Care Membership",
] as const;

export const contactMethods = ["Phone", "Email", "Text"] as const;

export type ServiceOption = (typeof serviceOptions)[number];
export type ContactMethod = (typeof contactMethods)[number];

export interface LeadIntakeFormData {
  name: string;
  phone: string;
  email: string;
  serviceAddress: string;
  servicesInterested: ServiceOption[];
  preferredContactMethod: ContactMethod;
  notes: string;
}

export const emptyLeadForm: LeadIntakeFormData = {
  name: "",
  phone: "",
  email: "",
  serviceAddress: "",
  servicesInterested: [],
  preferredContactMethod: "Phone",
  notes: "",
};
