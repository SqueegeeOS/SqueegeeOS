import { NextResponse } from "next/server";
import { profileForKnownRep } from "@/lib/sales/rep-config";
import {
  loadSalesRepProfile,
  SalesWorkspaceUnavailableError,
} from "@/lib/sales/workspace-server";

const ICONS = [
  { src: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
  { src: "/icons/icon-512x512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
  { src: "/icons/icon-maskable-512x512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repSlug: string }> },
) {
  const { repSlug } = await params;
  const slug = repSlug.trim().toLowerCase();
  let profile = profileForKnownRep(slug);

  if (!profile) {
    try {
      profile = await loadSalesRepProfile(slug);
    } catch (error) {
      if (!(error instanceof SalesWorkspaceUnavailableError)) {
        console.error("[sales-manifest] profile lookup failed", error);
      }
      return NextResponse.json({ error: "Sales workspace not found." }, { status: 404 });
    }
  }

  return NextResponse.json(
    {
      id: profile.workspacePath,
      name: `${profile.displayName} · HomeAtlas Field`,
      short_name: `${profile.displayName} Field`,
      description: `Private field sales workspace for ${profile.displayName}.`,
      start_url: profile.workspacePath,
      scope: "/",
      display: "standalone",
      background_color: "#090806",
      theme_color: "#090806",
      orientation: "portrait",
      icons: ICONS,
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "private, max-age=600",
      },
    },
  );
}
