import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export const HQ_MAGIC_LINK_WINDOW_SECONDS = 15 * 60;
export const HQ_MAGIC_LINK_EMAIL_LIMIT = 3;
export const HQ_MAGIC_LINK_NETWORK_LIMIT = 10;

export interface HqMagicLinkReservation {
  requestId: string;
  allowed: boolean;
}

export type HqMagicLinkDeliveryOutcome =
  | "provider_accepted"
  | "provider_rejected"
  | "provider_unknown";

interface LimiterRpcResult {
  request_id: string;
  is_allowed: boolean;
}

interface LimiterClient {
  rpc(
    name: "reserve_hq_magic_link_request",
    args: {
      requested_email_fingerprint: string;
      requested_network_fingerprint: string | null;
      requested_window_seconds: number;
      requested_email_limit: number;
      requested_network_limit: number;
    },
  ): PromiseLike<{
    data: LimiterRpcResult[] | LimiterRpcResult | null;
    error: { message: string } | null;
  }>;
}

interface DeliveryAuditClient {
  from(table: "hq_magic_link_delivery_events"): {
    insert(row: {
      request_event_id: string;
      outcome: HqMagicLinkDeliveryOutcome;
    }): PromiseLike<{ error: { message: string } | null }>;
  };
}

interface HqAdminEmailLookupClient {
  from(table: "hq_admin_users"): {
    select(columns: string): {
      eq(column: "email", value: string): {
        maybeSingle(): PromiseLike<{
          data: {
            user_id: string;
            email: string;
            role: string;
            active: boolean;
          } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export function normalizeHqLoginEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function fingerprintHqAuthValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function readHqRequestNetwork(
  request: Request,
  isVercelDeployment = process.env.VERCEL === "1",
): string | null {
  if (!isVercelDeployment) return null;
  const value = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (!value || value.length > 64 || value.includes(",") || isIP(value) === 0) {
    return null;
  }
  return value;
}

export function isHqEdgeAbuseControlVerified(
  configured = process.env.HQ_AUTH_EDGE_RATE_LIMIT_VERIFIED,
): boolean {
  return configured === "1";
}

export async function isActiveHqMagicLinkRecipient(
  email: string,
  clientOverride?: HqAdminEmailLookupClient,
): Promise<boolean> {
  const client =
    clientOverride ??
    (createServiceRoleSupabaseClient() as unknown as HqAdminEmailLookupClient);
  const { data, error } = await client
    .from("hq_admin_users")
    .select("user_id, email, role, active")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error("Headquarters recipient lookup is unavailable");
  return Boolean(
    data &&
      data.active === true &&
      (data.role === "owner" || data.role === "operator") &&
      data.email === email &&
      typeof data.user_id === "string" &&
      data.user_id.length > 0,
  );
}

export function classifyHqMagicLinkDeliveryError(
  error: unknown,
): HqMagicLinkDeliveryOutcome {
  if (!error) return "provider_accepted";
  if (typeof error !== "object") return "provider_unknown";
  const candidate = error as { name?: unknown; status?: unknown };
  if (candidate.name === "AuthRetryableFetchError") {
    return "provider_unknown";
  }
  const status =
    typeof candidate.status === "number" ? candidate.status : undefined;
  if (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 425 &&
    status !== 429
  ) {
    return "provider_rejected";
  }
  return "provider_unknown";
}

function getLimiterSecret(): string {
  const secret = process.env.HQ_AUTH_LIMITER_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("HQ_AUTH_LIMITER_SECRET must be at least 32 characters");
  }
  return secret;
}

export async function reserveHqMagicLinkRequest(
  email: string,
  network: string | null,
  overrides?: { client?: LimiterClient; secret?: string },
): Promise<HqMagicLinkReservation> {
  const secret = overrides?.secret ?? getLimiterSecret();
  const client =
    overrides?.client ??
    (createServiceRoleSupabaseClient() as unknown as LimiterClient);
  const result = await client.rpc("reserve_hq_magic_link_request", {
    requested_email_fingerprint: fingerprintHqAuthValue(
      `email:${email}`,
      secret,
    ),
    requested_network_fingerprint: network
      ? fingerprintHqAuthValue(`network:${network}`, secret)
      : null,
    requested_window_seconds: HQ_MAGIC_LINK_WINDOW_SECONDS,
    requested_email_limit: HQ_MAGIC_LINK_EMAIL_LIMIT,
    requested_network_limit: HQ_MAGIC_LINK_NETWORK_LIMIT,
  });
  if (result.error) throw new Error("Magic-link limiter is unavailable");
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.request_id || typeof row.is_allowed !== "boolean") {
    throw new Error("Magic-link limiter returned an invalid reservation");
  }
  return { requestId: row.request_id, allowed: row.is_allowed };
}

export async function recordHqMagicLinkDelivery(
  requestId: string,
  outcome: HqMagicLinkDeliveryOutcome,
  clientOverride?: DeliveryAuditClient,
): Promise<void> {
  const client =
    clientOverride ??
    (createServiceRoleSupabaseClient() as unknown as DeliveryAuditClient);
  const { error } = await client
    .from("hq_magic_link_delivery_events")
    .insert({ request_event_id: requestId, outcome });
  if (error) throw new Error("Magic-link delivery audit failed");
}
