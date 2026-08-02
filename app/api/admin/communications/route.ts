import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { getCommunicationsInbox } from "@/lib/communications/service";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { isServiceRoleConfigured } from "@/lib/persistence/supabase/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  if (!isCloudPersistenceConnected() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Customer communications storage is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const conversationId = url.searchParams.get("conversationId")?.trim() ?? "";
  if (query.length > 200 || conversationId.length > 128) {
    return NextResponse.json({ error: "Invalid communications query." }, { status: 400 });
  }

  try {
    const inbox = await getCommunicationsInbox({
      query: query || null,
      conversationId: conversationId || null,
    });
    if (conversationId && !inbox.selectedConversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    return NextResponse.json(inbox, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[communications] inbox load failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Customer communications could not be loaded." },
      { status: 500 },
    );
  }
}
