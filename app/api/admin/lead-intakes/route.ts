import { NextResponse } from "next/server";
import { listLeadIntakes } from "@/lib/acquisition/leads/repository";
import { authorizeAdminRequest } from "@/lib/admin/pin";

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leads = await listLeadIntakes();
    const newLeads = leads.filter((lead) => lead.status === "new");
    const newCount = newLeads.length;
    const latestNewSubmittedAt =
      newLeads.length > 0
        ? newLeads.reduce(
            (latest, lead) =>
              lead.submittedAt > latest ? lead.submittedAt : latest,
            newLeads[0].submittedAt,
          )
        : null;
    return NextResponse.json({ leads, newCount, latestNewSubmittedAt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lead intakes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
