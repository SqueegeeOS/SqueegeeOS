import { NextResponse } from "next/server";
import {
  createPropertyAssessment,
  listCustomerAssessments,
  listStaffAssessments,
  validateAssessmentForm,
} from "@/lib/health/assessment-repository";
import type { AssessmentFormState } from "@/lib/health/assessment-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AssessmentFormState>;
    const validationError = validateAssessmentForm(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const result = await createPropertyAssessment(body as AssessmentFormState);

    return NextResponse.json(
      {
        success: true,
        id: result.assessment.id,
        overallScore: result.assessment.overallScore,
        storage: result.storage,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[assessments POST]", error);
    return NextResponse.json(
      { error: "Failed to save assessment" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const view = searchParams.get("view") ?? "customer";

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 },
      );
    }

    if (view === "staff") {
      const assessments = await listStaffAssessments(propertyId);
      return NextResponse.json({ assessments });
    }

    const assessments = await listCustomerAssessments(propertyId);
    return NextResponse.json({ assessments });
  } catch (error) {
    console.error("[assessments GET]", error);
    return NextResponse.json(
      { error: "Failed to load assessments" },
      { status: 500 },
    );
  }
}
