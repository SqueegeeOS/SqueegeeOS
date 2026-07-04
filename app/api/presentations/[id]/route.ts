import { NextRequest, NextResponse } from "next/server";
import {
  getPresentation,
  patchPresentation,
} from "@/lib/presentations/repository";
import type { PresentationData } from "@/lib/presentations/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const presentation = await getPresentation(id);
    if (!presentation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ presentation });
  } catch (error) {
    console.error("[presentations] get error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<PresentationData>;
    const presentation = await patchPresentation(id, body);
    if (!presentation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ presentation });
  } catch (error) {
    console.error("[presentations] patch error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
