import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config } from "../../proxy";
import {
  refreshHqSupabaseSession,
  type HqProxyDependencies,
} from "./supabase-proxy";

const EXPECTED_CACHE_CONTROL =
  "private, no-cache, no-store, must-revalidate, max-age=0";

describe("PR1a/PR1b proxy coverage", () => {
  it("uses only the explicit fail-closed authentication scopes", () => {
    expect(config.matcher).toEqual([
      "/hq/:path*",
      "/presentations/:path*",
      "/employee/home-care-plan/create",
      "/api/persistence/home-care-plans",
      "/api/presentations/:path*",
      "/api/admin/care-operations/:path*",
      "/auth/hq/request",
      "/auth/hq/callback",
    ]);
  });
});

describe("Supabase session refresh response", () => {
  it("propagates refreshed cookies and every required no-cache header", async () => {
    const createClient: NonNullable<HqProxyDependencies["createClient"]> = vi
      .fn()
      .mockImplementation((_url, _key, options) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll(
              [
                {
                  name: "sb-auth-token",
                  value: "refreshed",
                  options: { httpOnly: true, path: "/", sameSite: "lax" },
                },
              ],
              {
                "Cache-Control": EXPECTED_CACHE_CONTROL,
                Expires: "0",
                Pragma: "no-cache",
              },
            );
            return { data: { user: null }, error: null };
          },
        },
      }));
    const request = new NextRequest(
      "https://homeatlas.example/api/admin/care-operations/jobber/oauth/status",
    );

    const response = await refreshHqSupabaseSession(request, {
      createClient,
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      emergencyDisabled: false,
    });

    expect(createClient).toHaveBeenCalledOnce();
    expect(response.headers.get("Cache-Control")).toBe(EXPECTED_CACHE_CONTROL);
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Set-Cookie")).toContain(
      "sb-auth-token=refreshed",
    );
  });

  it("fails every matched route closed during executable rollback", async () => {
    const createClient = vi.fn();
    for (const path of [
      "/hq",
      "/api/admin/care-operations/jobber/oauth/status",
      "/auth/hq/request",
      "/auth/hq/callback?code=example",
    ]) {
      const response = await refreshHqSupabaseSession(
        new NextRequest(`https://homeatlas.example${path}`, {
          headers: { "x-admin-pin": "legacy-shared-pin" },
        }),
        {
          createClient,
          supabaseUrl: "https://example.supabase.co",
          supabaseAnonKey: "anon-key",
          emergencyDisabled: true,
        },
      );

      expect(response.status, path).toBe(503);
      expect(response.headers.get("Cache-Control"), path).toBe(
        EXPECTED_CACHE_CONTROL,
      );
      expect(response.headers.get("Expires"), path).toBe("0");
      expect(response.headers.get("Pragma"), path).toBe("no-cache");
    }
    expect(createClient).not.toHaveBeenCalled();
  });
});
