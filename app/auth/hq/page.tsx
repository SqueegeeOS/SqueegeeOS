import type { Metadata } from "next";
import { GlassCard } from "@/components/craft/glass-card";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { HqLoginForm } from "@/app/auth/hq/hq-login-form";
import { resolveSafeHqNextPath } from "@/lib/auth/hq-navigation";

export const metadata: Metadata = {
  title: "Headquarters sign in | SqueegeeKing",
  robots: { index: false, follow: false },
};

interface HqLoginPageProps {
  searchParams: Promise<{
    next?: string | string[];
    status?: string | string[];
  }>;
}

export default async function HqLoginPage({ searchParams }: HqLoginPageProps) {
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const statusValue = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const statusMessage =
    statusValue === "service_unavailable"
      ? "Secure sign-in is temporarily unavailable. Please try again shortly."
      : statusValue === "access_unavailable"
        ? "Headquarters access is unavailable for this session."
        : null;

  return (
    <AmbientStage className="flex min-h-[100svh] items-center justify-center px-5 py-16">
      <div className="relative w-full max-w-md">
        <GlassCard tone="elevated" padding="lg" className="sm:!p-10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
            Secure operator access
          </p>
          <h1 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
            Headquarters
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Request a private, single-use sign-in link for an approved account.
          </p>
          {statusMessage ? (
            <p
              role="status"
              className="mt-6 rounded-2xl border border-border/70 bg-background/50 px-4 py-3 text-sm text-muted"
            >
              {statusMessage}
            </p>
          ) : null}
          <HqLoginForm nextPath={resolveSafeHqNextPath(nextValue)} />
        </GlassCard>
      </div>
    </AmbientStage>
  );
}
