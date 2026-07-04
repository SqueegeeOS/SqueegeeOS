"use client";

import {
  buildOAuthLocalInstructions,
  buildOAuthVercelInstructions,
} from "@/lib/reviews/google-oauth-setup";
import { GOOGLE_CONSOLE_LINKS } from "@/lib/reviews/google-reviews-wizard";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
    >
      {children}
      <span aria-hidden className="text-muted">
        ↗
      </span>
    </a>
  );
}

function CopyButton({
  label,
  text,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  copied: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => void onCopy(label, text)}
      className="rounded-full border border-border px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-muted hover:border-accent/25 hover:text-accent"
    >
      {copied === label ? "Copied" : "Copy"}
    </button>
  );
}

export function GoogleOAuthSetupGuide({
  redirectUri,
  clientIdConfigured,
  clientSecretConfigured,
  checking,
  copied,
  onCopy,
  onCheckAgain,
}: {
  redirectUri: string;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  checking: boolean;
  copied: string | null;
  onCopy: (label: string, text: string) => void;
  onCheckAgain: () => void;
}) {
  const vercelInstructions = buildOAuthVercelInstructions(redirectUri);
  const localInstructions = buildOAuthLocalInstructions(redirectUri);

  return (
    <div className="mt-4 space-y-5 rounded-[1.25rem] border border-border/70 bg-background/35 p-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
          One-time Google sign-in setup
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          Follow these steps in order. When both credentials are saved in Vercel
          and the site redeploys, the{" "}
          <strong className="text-foreground">Sign in with Google Business</strong>{" "}
          button will appear automatically — no code changes needed.
        </p>
      </div>

      <ol className="list-decimal space-y-5 pl-5 text-sm leading-relaxed text-muted">
        <li>
          <span className="text-foreground/90">Open the OAuth consent screen</span>
          <p className="mt-1">
            Go to{" "}
            <ExternalLink href={GOOGLE_CONSOLE_LINKS.oauthConsent}>
              Google Cloud → OAuth consent screen
            </ExternalLink>
            . Choose <strong className="text-foreground">External</strong> (or
            Internal if you use Google Workspace). App name:{" "}
            <strong className="text-foreground">SqueegeeKing</strong>. Add your
            email under Test users if the app is still in Testing mode.
          </p>
        </li>

        <li>
          <span className="text-foreground/90">Create an OAuth Web client</span>
          <p className="mt-1">
            Open{" "}
            <ExternalLink href={GOOGLE_CONSOLE_LINKS.oauthCreateClient}>
              Google Cloud → Create OAuth client ID
            </ExternalLink>
            . Application type:{" "}
            <strong className="text-foreground">Web application</strong>. Name
            it <strong className="text-foreground">SqueegeeKing Reviews</strong>.
          </p>
        </li>

        <li>
          <span className="text-foreground/90">
            Paste this Authorized redirect URI exactly
          </span>
          <p className="mt-1">
            In the OAuth client form, under{" "}
            <strong className="text-foreground">Authorized redirect URIs</strong>,
            click Add URI and paste:
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-foreground">
              {redirectUri}
            </code>
            <CopyButton
              label="redirect-uri"
              text={redirectUri}
              copied={copied}
              onCopy={onCopy}
            />
          </div>
          <p className="mt-2 text-xs">
            Must match character-for-character — include{" "}
            <code className="text-foreground/80">https://</code> and the full
            path ending in{" "}
            <code className="text-foreground/80">/oauth/callback</code>.
          </p>
        </li>

        <li>
          <span className="text-foreground/90">
            Copy Client ID and Client Secret into Vercel
          </span>
          <p className="mt-1">
            After creating the client, Google shows a{" "}
            <strong className="text-foreground">Client ID</strong> and{" "}
            <strong className="text-foreground">Client secret</strong>.
          </p>
          <p className="mt-2">
            In{" "}
            <ExternalLink href="https://vercel.com/docs/projects/environment-variables">
              Vercel → your project → Settings → Environment Variables
            </ExternalLink>
            , add:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            <li>
              <code className="text-foreground/85">GOOGLE_OAUTH_CLIENT_ID</code>{" "}
              → paste the Client ID
            </li>
            <li>
              <code className="text-foreground/85">GOOGLE_OAUTH_CLIENT_SECRET</code>{" "}
              → paste the Client secret
            </li>
          </ul>
          <p className="mt-2 text-xs">
            Enable both for <strong className="text-foreground">Production</strong>{" "}
            (and Preview if you test on preview URLs).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton
              label="vercel-oauth"
              text={vercelInstructions}
              copied={copied}
              onCopy={onCopy}
            />
            <CopyButton
              label="local-oauth"
              text={localInstructions}
              copied={copied}
              onCopy={onCopy}
            />
          </div>
        </li>

        <li>
          <span className="text-foreground/90">Redeploy, then return here</span>
          <p className="mt-1">
            Vercel → <strong className="text-foreground">Deployments</strong> →
            open the menu on the latest deployment →{" "}
            <strong className="text-foreground">Redeploy</strong>. New
            environment variables only take effect after a redeploy.
          </p>
        </li>
      </ol>

      <div className="rounded-xl border border-border/60 bg-background/45 px-4 py-3 text-xs text-muted">
        <p className="text-foreground/90">Setup progress on this server</p>
        <ul className="mt-2 space-y-1">
          <li>
            {clientIdConfigured ? "✅" : "○"}{" "}
            <code>GOOGLE_OAUTH_CLIENT_ID</code>{" "}
            {clientIdConfigured ? "detected" : "not detected yet"}
          </li>
          <li>
            {clientSecretConfigured ? "✅" : "○"}{" "}
            <code>GOOGLE_OAUTH_CLIENT_SECRET</code>{" "}
            {clientSecretConfigured ? "detected" : "not detected yet"}
          </li>
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCheckAgain}
          disabled={checking}
          className="rounded-full border border-accent/30 bg-accent/[0.12] px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-accent disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check if sign-in is ready"}
        </button>
        <p className="text-xs text-muted">
          We also check automatically every few seconds while you&apos;re on
          this step.
        </p>
      </div>
    </div>
  );
}
