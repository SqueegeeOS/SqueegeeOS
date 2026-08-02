# Google Business Profile full-review sync

HomeAtlas uses Google Business Profile owner OAuth to retrieve the complete
SqueegeeKing review archive. Google Places remains a supported fallback, but it
returns only a small review preview.

## One-time Google setup

1. Confirm the Google account owns or manages the verified SqueegeeKing profile.
2. Request [Business Profile API access](https://developers.google.com/my-business/content/prereqs).
3. Enable the My Business Account Management, Business Profile Business
   Information, and Google My Business APIs in the OAuth client project.
4. Keep the existing production OAuth values configured:
   `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and
   `GOOGLE_OAUTH_REDIRECT_URI`.
5. Configure a 32-byte `GOOGLE_TOKEN_ENCRYPTION_KEY`. If it is absent,
   HomeAtlas safely reuses the existing 32-byte `JOBBER_TOKEN_ENCRYPTION_KEY`.
6. Apply migration `042_google_business_full_reviews.sql`.

## Connect the owned location

1. Sign into HQ.
2. Open `/setup/google-reviews`.
3. Choose **Sign in with Google Business** and approve offline access.
4. Select the verified SqueegeeKing location and confirm it.

The confirmation endpoint verifies that the account/location pair was returned
by Google, encrypts the access and refresh tokens, and immediately tests the
paginated review endpoint. Full-review access is then ready for private owner
workflows.

Google documents Business Profile APIs as listing-management/reporting APIs and
directs end-user local-business displays to Google Maps Platform. Do not enable
public republication of the owner-only corpus until Google has confirmed that
use for this project. After confirmation, set:

```text
GOOGLE_BUSINESS_PUBLIC_FULL_REVIEWS_ENABLED=true
```

The default is `false`, so public surfaces use the supported Places preview and
link visitors to the source on Google Maps.

## Safety and fallback behavior

- OAuth start and connection routes require a valid HQ session. The cross-site
  callback consumes the one-time, HTTP-only OAuth state cookie before it may
  exchange a code (the HQ cookie is intentionally `SameSite=Strict`).
- Encrypted credentials are readable only through the Supabase service role.
- Review text and star ratings are not editorially filtered.
- Rating-only reviews remain visible as rating-only entries.
- Complete coverage is claimed only when the unique mapped count exactly
  matches Google's reported total; otherwise the result is labeled partial.
- Public responses are always browser/CDN `no-store`. When explicitly enabled,
  the owner corpus uses an eight-hour private server cache and a 24-hour hard
  display-age ceiling.
- If Business Profile access or refresh fails, the public site falls back to
  the Google Places preview instead of breaking the homepage.
- Do not scrape Google Maps as a workaround for missing API approval.
