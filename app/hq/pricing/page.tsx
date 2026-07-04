import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/navigation/config";

export default function HqPricingRedirect() {
  redirect(ROUTES.hqCarePlanBuilder);
}
