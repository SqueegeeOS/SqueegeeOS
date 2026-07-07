import { redirect } from "next/navigation";

export default async function HqRequestDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/hq/customers/lead/${id}`);
}
