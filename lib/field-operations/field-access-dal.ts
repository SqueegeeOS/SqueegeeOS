import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authorizeFieldRequest,
  type FieldActor,
} from "@/lib/field-operations/field-access";
import { canFieldActorAccessProperty } from "@/lib/field-operations/field-scope";

const currentFieldActor = cache(async (): Promise<FieldActor | null> => {
  const cookieStore = await cookies();
  return authorizeFieldRequest(
    new Headers({ cookie: cookieStore.toString() }),
  );
});

function fieldAccessPath(returnTo: string): string {
  const safeReturnTo = returnTo.startsWith("/tech") ? returnTo : "/tech";
  return `/tech/access?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export async function requireFieldPageActor(
  returnTo = "/tech",
): Promise<FieldActor> {
  const actor = await currentFieldActor();
  if (!actor) redirect(fieldAccessPath(returnTo));
  return actor;
}

export async function requireFieldPropertyPageActor(
  propertyId: string,
  returnTo: string,
): Promise<FieldActor> {
  const actor = await requireFieldPageActor(returnTo);
  if (!(await canFieldActorAccessProperty(actor, propertyId))) {
    redirect("/tech?access=property-denied");
  }
  return actor;
}
