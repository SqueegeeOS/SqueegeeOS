import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import type { HomeCarePlanDraft } from "@/lib/home-care-plan/create-types";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  getPersistenceAdapter,
  saveGeneratedHomeCarePlan,
} from "@/lib/persistence/repository";
import { isServiceRoleConfigured } from "@/lib/persistence/supabase/client";

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

function unavailable() {
  return NextResponse.json(
    { error: "Secure cloud persistence is not configured" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = 256): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isValidSlug(value: string | null): value is string {
  return Boolean(value && value.length <= 96 && SLUG_PATTERN.test(value));
}

function isHomeCarePlanData(value: unknown): value is HomeCarePlanData {
  if (!isRecord(value)) return false;
  const homeowner = value.homeowner;
  const property = value.property;

  return (
    isRecord(homeowner) &&
    isNonEmptyString(homeowner.fullName) &&
    isNonEmptyString(homeowner.slug, 96) &&
    isRecord(property) &&
    isNonEmptyString(property.name) &&
    isNonEmptyString(property.slug, 96) &&
    Array.isArray(value.memberships) &&
    Array.isArray(value.findings)
  );
}

function assertSecurePersistence() {
  return isCloudPersistenceConnected() && isServiceRoleConfigured();
}

export async function GET(request: NextRequest) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  if (!assertSecurePersistence()) return unavailable();

  try {
    if (request.nextUrl.searchParams.get("list") === "1") {
      const records = await getPersistenceAdapter().listHomeCarePlans();
      return NextResponse.json(
        { records },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const homeownerSlug = request.nextUrl.searchParams.get("homeownerSlug");
    const propertySlug = request.nextUrl.searchParams.get("propertySlug");
    if (!isValidSlug(homeownerSlug) || !isValidSlug(propertySlug)) {
      return NextResponse.json(
        { error: "Valid homeowner and property slugs are required" },
        { status: 400 },
      );
    }

    const record = await getPersistenceAdapter().getHomeCarePlanBySlugs(
      homeownerSlug,
      propertySlug,
    );

    return NextResponse.json(
      { record },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[home-care-plans] secure load failed", error);
    return NextResponse.json(
      { error: "Failed to load the Home Care Plan" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  if (!assertSecurePersistence()) return unavailable();

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Home Care Plan payload is too large" },
      { status: 413 },
    );
  }

  try {
    const body = (await request.json()) as {
      presentation?: unknown;
      draft?: unknown;
    };
    if (!isHomeCarePlanData(body.presentation)) {
      return NextResponse.json(
        { error: "Invalid Home Care Plan payload" },
        { status: 400 },
      );
    }
    if (body.draft !== null && body.draft !== undefined && !isRecord(body.draft)) {
      return NextResponse.json(
        { error: "Invalid Home Care Plan draft" },
        { status: 400 },
      );
    }

    const outcome = await saveGeneratedHomeCarePlan(
      body.presentation,
      (body.draft as HomeCarePlanDraft | null | undefined) ?? null,
    );
    return NextResponse.json(
      { record: outcome.record },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[home-care-plans] secure save failed", error);
    return NextResponse.json(
      { error: "Failed to save the Home Care Plan" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  if (!assertSecurePersistence()) return unavailable();

  const homeownerSlug = request.nextUrl.searchParams.get("homeownerSlug");
  const propertySlug = request.nextUrl.searchParams.get("propertySlug");
  if (!isValidSlug(homeownerSlug) || !isValidSlug(propertySlug)) {
    return NextResponse.json(
      { error: "Valid homeowner and property slugs are required" },
      { status: 400 },
    );
  }

  try {
    await getPersistenceAdapter().deleteHomeCarePlan(
      homeownerSlug,
      propertySlug,
    );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[home-care-plans] secure delete failed", error);
    return NextResponse.json(
      { error: "Failed to delete the Home Care Plan" },
      { status: 500 },
    );
  }
}
