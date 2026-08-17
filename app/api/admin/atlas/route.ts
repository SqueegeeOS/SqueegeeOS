import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { atlasOperatorAgent } from "@/lib/concierge/operator-agent";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 40;
const MAX_BODY_BYTES = 120_000;

function validMessages(value: unknown): value is UIMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_MESSAGES &&
    value.every(
      (message) =>
        message !== null &&
        typeof message === "object" &&
        "role" in message &&
        ["user", "assistant"].includes(
          String((message as { role?: unknown }).role),
        ),
    )
  );
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      { error: "Atlas is not configured with an OpenAI API key." },
      { status: 503 },
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Conversation is too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const messages =
    payload && typeof payload === "object" && "messages" in payload
      ? (payload as { messages?: unknown }).messages
      : null;

  if (!validMessages(messages)) {
    return Response.json(
      { error: "A valid, bounded conversation is required." },
      { status: 400 },
    );
  }

  return createAgentUIStreamResponse({
    agent: atlasOperatorAgent,
    uiMessages: messages,
    abortSignal: request.signal,
    timeout: { totalMs: 55_000 },
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
