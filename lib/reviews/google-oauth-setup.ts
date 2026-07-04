export function buildOAuthVercelInstructions(redirectUri: string): string {
  return `Vercel → Your project → Settings → Environment Variables

Add these two variables (Production + Preview):

Name: GOOGLE_OAUTH_CLIENT_ID
Value: (paste Client ID from Google Cloud)

Name: GOOGLE_OAUTH_CLIENT_SECRET
Value: (paste Client Secret from Google Cloud)

Optional — only if your domain differs from this deployment:
Name: GOOGLE_OAUTH_REDIRECT_URI
Value: ${redirectUri}

Then: Deployments → … on latest → Redeploy`;
}

export function buildOAuthLocalInstructions(redirectUri: string): string {
  return `# Google Business OAuth (server-only — add to .env.local)
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
# Optional override (defaults to this site's callback URL):
# GOOGLE_OAUTH_REDIRECT_URI=${redirectUri}`;
}
