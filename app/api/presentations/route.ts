import { NextRequest, NextResponse } from "next/server";
import {
  createPresentation,
  listPresentations,
} from "@/lib/presentations/repository";

export async function GET() {
  try {
    const presentations = await listPresentations();
    return NextResponse.json({ presentations });
  } catch (error) {
    console.error("[presentations] list error:", error);
    return NextResponse.json(
      { error: "Failed to list presentations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const presentation = await createPresentation({
      clientName: body.clientName,
      createdBy: body.createdBy,
    });
    return NextResponse.json({ presentation }, { status: 201 });
  } catch (error) {
    console.error("[presentations] create error:", error);
    return NextResponse.json(
      { error: "Failed to create presentation" },
      { status: 500 },
    );
  }
}
