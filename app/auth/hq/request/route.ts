import { handleHqMagicLinkRequest } from "@/lib/auth/hq-magic-link-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleHqMagicLinkRequest(request);
}
