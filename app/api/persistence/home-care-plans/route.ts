import { NextResponse } from "next/server";
import { authorizeHqApiRequest } from "@/lib/auth/hq-route-authorization";
import { parseHomeCarePlanDraft } from "@/lib/home-care-plan/authority-input";
import { HomeCarePlanPricingInputError } from "@/lib/home-care-plan/atlas-pricing";
import { readLimitedJsonObject } from "@/lib/http/read-limited-json-object";
import { saveHomeCarePlanFromAuthorizedDraft } from "@/lib/persistence/server/save-home-care-plan";

const HOME_CARE_PLAN_MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const authorization = await authorizeHqApiRequest();
  if (authorization.response) return authorization.response;

  const body = await readLimitedJsonObject(
    request,
    HOME_CARE_PLAN_MAX_BODY_BYTES,
  );
  if (!body || Object.keys(body).length !== 1) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const draft = parseHomeCarePlanDraft(body.draft);
  if (!draft) {
    return NextResponse.json({ error: "Invalid Home Care Plan" }, { status: 400 });
  }

  try {
    const record = await saveHomeCarePlanFromAuthorizedDraft(draft);
    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof HomeCarePlanPricingInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[home-care-plan] authorized save failed:", error);
    return NextResponse.json(
      { error: "Failed to save Home Care Plan" },
      { status: 500 },
    );
  }
}
