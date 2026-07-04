import { redirect } from "next/navigation";

interface TechAssessmentRedirectProps {
  searchParams: Promise<{
    propertyId?: string;
    visitId?: string;
    mode?: string;
  }>;
}

export default async function TechAssessmentRedirect({
  searchParams,
}: TechAssessmentRedirectProps) {
  const params = await searchParams;
  const propertyId = params.propertyId?.trim();

  if (!propertyId) {
    redirect("/tech");
  }

  const query = new URLSearchParams();
  if (params.visitId) query.set("visitId", params.visitId);
  if (params.mode) query.set("mode", params.mode);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  redirect(`/tech/properties/${propertyId}/assessment${suffix}`);
}
