import { describe, expect, it } from "vitest";
import {
  buildSalesPhoneInstallQrDataUrl,
  isSalesPhoneInstallUrl,
} from "./phone-install-qr";

const token = "A".repeat(43);
const installUrl = `https://www.squeegeeking.net/sales/access?token=${token}&rep=david&returnTo=%2Fdavid`;

describe("sales phone install QR", () => {
  it("encodes a same-purpose HTTPS phone pass entirely as a local data URL", async () => {
    expect(isSalesPhoneInstallUrl(installUrl)).toBe(true);
    await expect(buildSalesPhoneInstallQrDataUrl(installUrl)).resolves.toMatch(
      /^data:image\/png;base64,/,
    );
  });

  it("refuses unrelated, insecure, or malformed destinations", async () => {
    expect(
      isSalesPhoneInstallUrl(
        `https://www.squeegeeking.net/hq?token=${token}&rep=david`,
      ),
    ).toBe(false);
    expect(
      isSalesPhoneInstallUrl(
        `http://example.com/sales/access?token=${token}&rep=david`,
      ),
    ).toBe(false);
    expect(
      isSalesPhoneInstallUrl(
        "https://www.squeegeeking.net/sales/access?token=short&rep=david",
      ),
    ).toBe(false);
    await expect(
      buildSalesPhoneInstallQrDataUrl("https://example.com/not-a-pass"),
    ).rejects.toThrow("not safe to encode");
  });
});
