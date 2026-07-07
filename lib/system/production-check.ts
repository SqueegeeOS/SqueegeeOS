import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  probeSignedAgreementsBucketPublic,
  SIGNED_AGREEMENT_BUCKET,
} from "@/lib/agreement/signed-agreement-storage";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { getStripePublishableKey } from "@/lib/stripe/client";
import { isStripeLiveMode, resolveStripeKeyMode } from "@/lib/stripe/mode";

export type ProductionMode = "production" | "degraded" | "development";

export interface ProductionCheckResult {
  supabase: boolean;
  storage: boolean;
  storageSafe: boolean;
  resend: boolean;
  stripe: boolean;
  stripeLive: boolean;
  persistence: boolean;
  mode: ProductionMode;
  checkedAt: string;
  details: {
    supabase: { configured: boolean; reachable: boolean; message?: string };
    storage: {
      bucket: "signed-agreements";
      ready: boolean;
      private: boolean;
      serviceRole: boolean;
      safe: boolean;
      message?: string;
    };
    resend: {
      apiKey: boolean;
      fromAddress: boolean;
      from?: string | null;
      message?: string;
    };
    stripe: {
      publishableKey: boolean;
      secretKey: boolean;
      liveMode: boolean;
      keyMode: ReturnType<typeof resolveStripeKeyMode>;
      message?: string;
    };
    persistence: {
      backend: string;
      cloudConnected: boolean;
    };
  };
}

function resolveMode(flags: {
  supabase: boolean;
  storageSafe: boolean;
  resend: boolean;
  stripe: boolean;
  stripeLive: boolean;
  persistence: boolean;
}): ProductionMode {
  if (
    flags.supabase &&
    flags.storageSafe &&
    flags.resend &&
    flags.stripe &&
    flags.stripeLive &&
    flags.persistence
  ) {
    return "production";
  }
  if (flags.persistence && flags.supabase) {
    return "degraded";
  }
  return "development";
}

export async function runProductionCheck(): Promise<ProductionCheckResult> {
  const persistence = isCloudPersistenceConnected();
  const supabaseConfigured = isSupabaseConfigured();

  let supabaseReachable = false;
  let supabaseMessage: string | undefined;

  if (supabaseConfigured) {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.from("presentations").select("id").limit(1);
      if (error) {
        supabaseMessage = error.message;
      } else {
        supabaseReachable = true;
      }
    } catch (error) {
      supabaseMessage =
        error instanceof Error ? error.message : "Supabase query failed";
    }
  } else {
    supabaseMessage = "NEXT_PUBLIC_SUPABASE_URL or ANON_KEY missing";
  }

  const supabase = supabaseConfigured && supabaseReachable;

  let storageReady = false;
  let storagePrivate = false;
  let storageMessage: string | undefined;
  const serviceRoleConfigured = isServiceRoleConfigured();

  if (supabaseConfigured) {
    const probe = await probeSignedAgreementsBucketPublic();
    if (probe === "private") {
      storagePrivate = true;
    } else if (probe === "public") {
      storageMessage =
        "signed-agreements bucket is world-readable — run migration 017";
    }

    if (serviceRoleConfigured) {
      try {
        const supabase = createServiceRoleSupabaseClient();
        const { data: bucket, error: bucketError } = await supabase.storage.getBucket(
          SIGNED_AGREEMENT_BUCKET,
        );

        if (!bucketError && bucket) {
          storagePrivate = !bucket.public;
          if (bucket.public) {
            storageMessage =
              "signed-agreements bucket is public — run migration 017";
          }
        } else if (bucketError && !storageMessage) {
          storageMessage = bucketError.message;
        }

        const { error: listError } = await supabase.storage
          .from(SIGNED_AGREEMENT_BUCKET)
          .list("", { limit: 1 });

        if (listError) {
          if (!storageMessage) storageMessage = listError.message;
        } else {
          storageReady = true;
        }
      } catch (error) {
        storageMessage =
          error instanceof Error ? error.message : "Storage check failed";
      }
    } else {
      storageMessage =
        "SUPABASE_SERVICE_ROLE_KEY not set — required for private agreement PDFs";
    }
  } else {
    storageMessage = "Supabase not configured";
  }

  const storageSafe =
    storageReady && storagePrivate && serviceRoleConfigured;

  const resendApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const resendFrom = process.env.RESEND_AGREEMENT_FROM?.trim() || null;
  const resendFromAddress = Boolean(resendFrom);
  const resend = resendApiKey && resendFromAddress;

  let resendMessage: string | undefined;
  if (!resendApiKey) {
    resendMessage = "RESEND_API_KEY not set in Vercel";
  } else if (!resendFromAddress) {
    resendMessage = "RESEND_AGREEMENT_FROM not set";
  } else if (resendFrom?.includes("resend.dev")) {
    resendMessage =
      "Using Resend sandbox sender — verify your domain for production";
  }

  const stripePublishable = Boolean(getStripePublishableKey());
  const stripeSecret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripe = isStripeServerEnabled();
  const stripeKeyMode = resolveStripeKeyMode();
  const stripeLive = isStripeLiveMode();

  let stripeMessage: string | undefined;
  if (!stripePublishable) {
    stripeMessage = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set";
  } else if (!stripeSecret) {
    stripeMessage = "STRIPE_SECRET_KEY not set";
  } else if (stripeKeyMode === "test") {
    stripeMessage =
      "Stripe test keys — switch to sk_live_ / pk_live_ before Customer #1";
  } else if (stripeKeyMode === "mismatch") {
    stripeMessage = "Stripe publishable and secret keys are not the same mode";
  } else if (stripeKeyMode === "missing") {
    stripeMessage = "Stripe keys missing or unrecognized";
  }

  const mode = resolveMode({
    supabase,
    storageSafe,
    resend,
    stripe,
    stripeLive,
    persistence,
  });

  return {
    supabase,
    storage: storageReady,
    storageSafe,
    resend,
    stripe,
    stripeLive,
    persistence,
    mode,
    checkedAt: new Date().toISOString(),
    details: {
      supabase: {
        configured: supabaseConfigured,
        reachable: supabaseReachable,
        message: supabaseMessage,
      },
      storage: {
        bucket: "signed-agreements",
        ready: storageReady,
        private: storagePrivate,
        serviceRole: serviceRoleConfigured,
        safe: storageSafe,
        message: storageMessage,
      },
      resend: {
        apiKey: resendApiKey,
        fromAddress: resendFromAddress,
        from: resendFrom,
        message: resendMessage,
      },
      stripe: {
        publishableKey: stripePublishable,
        secretKey: stripeSecret,
        liveMode: stripeLive,
        keyMode: stripeKeyMode,
        message: stripeMessage,
      },
      persistence: {
        backend:
          process.env.NEXT_PUBLIC_PERSISTENCE_BACKEND ??
          (process.env.NEXT_PUBLIC_SUPABASE_ENABLED === "true"
            ? "supabase"
            : "session"),
        cloudConnected: persistence,
      },
    },
  };
}
