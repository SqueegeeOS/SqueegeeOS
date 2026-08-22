import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { getLeadIntakeById } from "@/lib/acquisition/leads/repository";
import { runLeadAcknowledgementAutomation } from "@/lib/communications/lead-automation";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { isServiceRoleConfigured } from "@/lib/persistence/supabase/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  if (!isCloudPersistenceConnected() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Lead communications storage is not configured." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id.trim() || id.length > 128) {
    return NextResponse.json({ error: "Lead ID is required." }, { status: 400 });
  }

  const lead = await getLeadIntakeById(id.trim());
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  try {
    const result = await runLeadAcknowledgementAutomation(lead);
    if (!result.smsSent && !result.smsScheduled && !result.smsDuplicate) {
      return NextResponse.json(
        {
          error: "The welcome text is still blocked by consent or provider readiness.",
          code: result.smsReason ?? "welcome_text_blocked",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      conversationId: result.conversationId,
      smsSent: result.smsSent,
      smsScheduled: result.smsScheduled,
      duplicate: result.smsDuplicate,
    });
  } catch (error) {
    console.error("[lead-welcome-retry] retry failed", {
      leadId: id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "The welcome text could not be retried." },
      { status: 500 },
    );
  }
}
