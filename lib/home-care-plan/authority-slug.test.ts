import { describe, expect, it } from "vitest";
import { customerAuthoritySlugSuffix } from "./authority-slug";

describe("Home Care Plan source identity", () => {
  it("separates same-name customers and is stable for retry", () => {
    const first = {
      fullName: "Alex Kim",
      email: "alex.one@example.com",
      propertyName: "Home",
      address: "1 Oak Way",
    };
    const second = { ...first, email: "alex.two@example.com", address: "2 Oak Way" };
    expect(customerAuthoritySlugSuffix(first)).toBe(
      customerAuthoritySlugSuffix(first),
    );
    expect(customerAuthoritySlugSuffix(first)).not.toBe(
      customerAuthoritySlugSuffix(second),
    );
  });
});
