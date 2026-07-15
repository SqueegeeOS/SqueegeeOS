# Follow-up: retire the legacy Headquarters PIN

**Named follow-up:** HQ-AUTH-PR1b-plus
**Status:** Required after PR1a is proven; intentionally not implemented here

PR1a removes shared-PIN authority only from Care Operations and Jobber while adding Supabase authentication around `/hq`. The remaining Headquarters clients and `/api/admin/**` routes still use the legacy `NEXT_PUBLIC_ADMIN_PIN` flow and must not be silently re-scoped in PR1a.

The retirement change should:

1. Inventory every remaining `getAdminRequestHeaders`, `authorizeAdminRequest`, `verifyAdminPin`, and `NEXT_PUBLIC_ADMIN_PIN` use.
2. Move each remaining server route to `requireHqActor`, with actor UUID propagation wherever an existing audit field permits it.
3. Replace the browser `AdminPinGate` and session-storage PIN state only after all dependent APIs use authenticated cookies.
4. Remove `x-admin-pin` from remaining browser calls and then remove the public PIN environment variable and obsolete client helpers.
5. Add route coverage, rollback, and an independent authorization review.
6. Keep migration-030/PR1b policy work separately scoped and evidence-backed.

Exit condition: no production Headquarters authority depends on a shared secret delivered to the browser, and a repository-wide search finds no operational `NEXT_PUBLIC_ADMIN_PIN` or `x-admin-pin` path.
