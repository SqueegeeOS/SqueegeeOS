import "server-only";

import { redirect } from "next/navigation";
import {
  HqAccessError,
  requireHqActor,
  type HqActor,
} from "@/lib/auth/hq-access";

export async function requireHqPage(nextPath: string): Promise<HqActor> {
  try {
    return await requireHqActor();
  } catch (error) {
    if (error instanceof HqAccessError && error.status === 403) {
      redirect("/auth/hq?status=access_unavailable");
    }
    if (error instanceof HqAccessError && error.status === 503) {
      redirect("/auth/hq?status=service_unavailable");
    }
    redirect(`/auth/hq?next=${encodeURIComponent(nextPath)}`);
  }
}
