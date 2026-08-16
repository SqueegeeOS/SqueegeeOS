import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authorizeSalesRequest,
  canSalesActorAccessRep,
  salesActorOwnsPresentation,
  type SalesActor,
} from "@/lib/sales/sales-access";
import {
  salesAccessPath,
  salesWorkspacePath,
} from "@/lib/sales/sales-access-paths";

const currentSalesActor = cache(async (): Promise<SalesActor | null> => {
  const cookieStore = await cookies();
  return authorizeSalesRequest(
    new Headers({ cookie: cookieStore.toString() }),
  );
});

export async function requireSalesWorkspacePageActor(
  repSlug: string,
  returnTo = salesWorkspacePath(repSlug),
): Promise<SalesActor> {
  const actor = await currentSalesActor();
  if (!actor) {
    redirect(salesAccessPath({ returnTo, repSlug }));
  }
  if (!canSalesActorAccessRep(actor, repSlug)) {
    redirect(
      actor.kind === "sales_rep"
        ? `${salesWorkspacePath(actor.repSlug)}?access=rep-denied`
        : "/hq",
    );
  }
  return actor;
}

export async function requireNewPresentationPageActor(
  repSlug: string | null,
  returnTo: string,
): Promise<SalesActor> {
  const actor = await currentSalesActor();
  if (!actor) {
    redirect(salesAccessPath({ returnTo, repSlug }));
  }
  if (
    actor.kind === "sales_rep" &&
    (!repSlug || !canSalesActorAccessRep(actor, repSlug))
  ) {
    redirect(`${salesWorkspacePath(actor.repSlug)}?access=presentation-denied`);
  }
  return actor;
}

export async function requireSalesPresentationPageActor(
  presentationId: string,
  returnTo: string,
): Promise<SalesActor> {
  const actor = await currentSalesActor();
  if (!actor) {
    redirect(salesAccessPath({ returnTo }));
  }
  if (!(await salesActorOwnsPresentation(actor, presentationId))) {
    redirect(
      actor.kind === "sales_rep"
        ? `${salesWorkspacePath(actor.repSlug)}?access=presentation-denied`
        : "/presentations",
    );
  }
  return actor;
}
