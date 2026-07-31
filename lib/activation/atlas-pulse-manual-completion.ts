import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import type { AtlasPulseManualCompletion } from "./atlas-pulse-types";

const FOUNDER_ACTOR = "hq_founder";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ConfirmationRow {
  email_complete: boolean;
  email_confirmed_at: string | null;
  portal_complete: boolean;
  portal_confirmed_at: string | null;
}

export class AtlasPulseManualCompletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AtlasPulseManualCompletionError";
  }
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.message ?? "").toLowerCase().includes("does not exist") ||
    (error.message ?? "").toLowerCase().includes("schema cache")
  );
}

function toManualCompletion(row: ConfirmationRow | null): AtlasPulseManualCompletion {
  return {
    emailComplete: row?.email_complete === true,
    emailConfirmedAt: row?.email_confirmed_at ?? null,
    portalComplete: row?.portal_complete === true,
    portalConfirmedAt: row?.portal_confirmed_at ?? null,
  };
}

export async function setAtlasPulseManualCompletion(input: {
  membershipId: string;
  completed: boolean;
}): Promise<AtlasPulseManualCompletion> {
  if (!UUID_PATTERN.test(input.membershipId)) {
    throw new AtlasPulseManualCompletionError("Invalid membership.", 400);
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, portal_access_token")
    .eq("id", input.membershipId)
    .maybeSingle();

  if (membershipError) {
    throw new AtlasPulseManualCompletionError(
      "The membership could not be verified.",
      503,
    );
  }
  if (!membership) {
    throw new AtlasPulseManualCompletionError("Membership not found.", 404);
  }
  if (input.completed && !membership.portal_access_token) {
    throw new AtlasPulseManualCompletionError(
      "Create the customer portal link before confirming the handoff.",
      409,
    );
  }

  const existingResult = await supabase
    .from("membership_activation_confirmations")
    .select(
      "email_complete, email_confirmed_at, portal_complete, portal_confirmed_at",
    )
    .eq("membership_id", input.membershipId)
    .maybeSingle();

  if (existingResult.error) {
    throw new AtlasPulseManualCompletionError(
      isMissingTable(existingResult.error)
        ? "Founder confirmation needs database migration 037."
        : "The current founder confirmation could not be loaded.",
      503,
    );
  }

  const existing = (existingResult.data as ConfirmationRow | null) ?? null;
  if (
    existing &&
    existing.email_complete === input.completed &&
    existing.portal_complete === input.completed
  ) {
    return toManualCompletion(existing);
  }
  if (!existing && !input.completed) {
    return toManualCompletion(null);
  }

  const now = new Date().toISOString();
  const values = {
    membership_id: input.membershipId,
    email_complete: input.completed,
    email_confirmed_at: input.completed ? now : null,
    email_confirmed_by: input.completed ? FOUNDER_ACTOR : null,
    portal_complete: input.completed,
    portal_confirmed_at: input.completed ? now : null,
    portal_confirmed_by: input.completed ? FOUNDER_ACTOR : null,
    last_changed_by: FOUNDER_ACTOR,
    change_reason: input.completed
      ? "Founder confirmed the customer email and portal handoff in Atlas Pulse."
      : "Founder reopened the customer email and portal handoff in Atlas Pulse.",
  };

  const writeResult = existing
    ? await supabase
        .from("membership_activation_confirmations")
        .update(values)
        .eq("membership_id", input.membershipId)
        .select(
          "email_complete, email_confirmed_at, portal_complete, portal_confirmed_at",
        )
        .single()
    : await supabase
        .from("membership_activation_confirmations")
        .insert(values)
        .select(
          "email_complete, email_confirmed_at, portal_complete, portal_confirmed_at",
        )
        .single();

  if (writeResult.error || !writeResult.data) {
    console.error("[atlas-pulse] founder confirmation write failed", {
      membershipId: input.membershipId,
      reason: writeResult.error?.message ?? "missing response row",
    });
    throw new AtlasPulseManualCompletionError(
      "The founder confirmation was not changed. Try again.",
      503,
    );
  }

  return toManualCompletion(writeResult.data as ConfirmationRow);
}
