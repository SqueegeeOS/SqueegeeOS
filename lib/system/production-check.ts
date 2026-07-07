import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isStripeServerEnabled } from "@/lib/stripe/config";
import { getStripePublishableKey } from "@/lib/stripe/client";

export type ProductionMode = "production" | "degraded" | "development";

export interface ProductionCheckResult {
  supabase: boolean;
  storage: boolean;
  resend: boolean;
  stripe: boolean;
  persistence: boolean;
  mode: ProductionMode;
  checkedAt: string;
  details: {
    supabase: { configured: boolean; reachable: boolean; message?: string };
    storage: {
      bucket: "signed-agreements";
      ready: boolean;
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
  storage: boolean;
  resend: boolean;
  stripe: boolean;
  persistence: boolean;
}): ProductionMode {
  if (
    flags.supabase &&
    flags.storage &&
    flags.resend &&
    flags.stripe &&
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
  let storageMessage: string | undefined;

  if (supabaseConfigured) {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.storage
        .from("signed-agreements")
        .list("", { limit: 1 });

      if (error) {
        storageMessage = error.message;
      } else {
        storageReady = true;
      }
    } catch (error) {
      storageMessage =
        error instanceof Error ? error.message : "Storage check failed";
    }
  } else {
    storageMessage = "Supabase not configured";
  }

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

  let stripeMessage: string | undefined;
  if (!stripePublishable) {
    stripeMessage = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set";
  } else if (!stripeSecret) {
    stripeMessage = "STRIPE_SECRET_KEY not set";
  }

  const mode = resolveMode({
    supabase,
    storage: storageReady,
    resend,
    stripe,
    persistence,
  });

  return {
    supabase,
    storage: storageReady,
    resend,
    stripe,
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
