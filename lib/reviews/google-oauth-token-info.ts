export interface OAuthTokenInfo {
  scope?: string;
  email?: string;
  expires_in?: string;
  error?: string;
}

export async function fetchOAuthTokenInfo(
  accessToken: string,
): Promise<OAuthTokenInfo | null> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    return (await response.json()) as OAuthTokenInfo;
  } catch {
    return null;
  }
}

export async function resolveOAuthEmail(
  accessToken: string,
  cachedEmail?: string,
): Promise<string | null> {
  if (cachedEmail?.trim()) return cachedEmail.trim();

  const tokenInfo = await fetchOAuthTokenInfo(accessToken);
  if (tokenInfo?.email?.trim()) return tokenInfo.email.trim();

  try {
    const userinfo = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (userinfo.ok) {
      const profile = (await userinfo.json()) as { email?: string };
      if (profile.email?.trim()) return profile.email.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

export function tokenHasBusinessManageScope(scope?: string): boolean {
  if (!scope) return false;
  return scope.includes("business.manage");
}
