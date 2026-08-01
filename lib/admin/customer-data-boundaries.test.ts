import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("customer data route boundaries", () => {
  it("protects presentation reads and writes at the route handler", () => {
    for (const route of [
      "app/api/presentations/route.ts",
      "app/api/presentations/[id]/route.ts",
    ]) {
      const source = readProjectFile(route);
      expect(source).toContain("authorizeAdminRequest");
      expect(source).toMatch(
        /authorizeAdminRequest\((?:req|request)\.headers\)/,
      );
    }
  });

  it("does not query presentation records in anonymous server pages", () => {
    for (const page of [
      "app/presentations/page.tsx",
      "app/presentations/new/page.tsx",
      "app/presentations/[id]/edit/page.tsx",
      "app/presentations/[id]/present/page.tsx",
    ]) {
      const source = readProjectFile(page);
      expect(source).not.toContain('from "@/lib/presentations/repository"');
    }
  });

  it("keeps the public PIN variable out of client components", () => {
    expect(
      readProjectFile("components/admin/admin-pin-gate.tsx"),
    ).not.toContain("NEXT_PUBLIC_ADMIN_PIN");
    expect(readProjectFile("lib/admin/pin.ts")).not.toContain(
      "NEXT_PUBLIC_ADMIN_PIN",
    );
    expect(readProjectFile("lib/admin/pin.ts")).not.toContain(
      "ADMIN_PIN_SESSION_KEY",
    );
  });

  it("protects operator pages before their server components run", () => {
    const source = readProjectFile("proxy.ts");

    for (const route of [
      "/hq/:path+",
      "/employee/:path*",
      "/tech/:path*",
      "/properties/:path*",
      "/setup/:path*",
      "/experience/:path*",
      "/homecare/:path*",
    ]) {
      expect(source).toContain(`"${route}"`);
    }

    expect(source).toContain("verifyAdminSessionToken");
  });

  it("authorizes payment changes with an admin session or portal token", () => {
    for (const route of [
      "app/api/stripe/setup-intent/route.ts",
      "app/api/membership/setup-payment/route.ts",
    ]) {
      expect(readProjectFile(route)).toContain("authorizeMembershipAction");
    }
  });

  it("protects the Jobber Today schedule at the route handler", () => {
    const source = readProjectFile(
      "app/api/admin/care-operations/jobber/today/route.ts",
    );
    expect(source).toContain("authorizeAdminRequest");
    expect(source).toMatch(/authorizeAdminRequest\(request\.headers\)/);
  });
});
