import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  fetchAddressSuggestions,
  fetchResolvedAddress,
} from "@/lib/address/google-places-address";

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,36}$/;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return error("Unauthorized", 401);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return error("Address suggestions are not configured.", 503);
  }

  const body = (await request.json()) as {
    action?: "suggest" | "details";
    input?: string;
    placeId?: string;
    sessionToken?: string;
  };
  const sessionToken = body.sessionToken?.trim() ?? "";
  if (!SESSION_TOKEN_PATTERN.test(sessionToken)) {
    return error("A valid address search session is required.", 400);
  }

  try {
    if (body.action === "suggest") {
      const input = body.input?.trim().slice(0, 180) ?? "";
      if (input.length < 4) return NextResponse.json({ suggestions: [] });
      const suggestions = await fetchAddressSuggestions(
        input,
        sessionToken,
        apiKey,
      );
      return NextResponse.json({ suggestions });
    }

    if (body.action === "details") {
      const placeId = body.placeId?.trim().slice(0, 255) ?? "";
      if (!placeId) return error("Choose an address first.", 400);
      const address = await fetchResolvedAddress(placeId, sessionToken, apiKey);
      if (!address) return error("That address could not be completed.", 422);
      return NextResponse.json({ address });
    }

    return error("Unknown address action.", 400);
  } catch (cause) {
    console.error("Address autocomplete failed", cause);
    return error("Address lookup is temporarily unavailable.", 502);
  }
}
