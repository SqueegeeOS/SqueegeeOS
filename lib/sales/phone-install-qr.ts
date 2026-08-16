const SALES_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const REP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSalesPhoneInstallUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const secureOrigin =
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
    const token = url.searchParams.get("token") ?? "";
    const repSlug = url.searchParams.get("rep") ?? "";
    return (
      secureOrigin &&
      url.pathname === "/sales/access" &&
      SALES_TOKEN_PATTERN.test(token) &&
      REP_SLUG_PATTERN.test(repSlug)
    );
  } catch {
    return false;
  }
}

export async function buildSalesPhoneInstallQrDataUrl(
  installUrl: string,
): Promise<string> {
  if (!isSalesPhoneInstallUrl(installUrl)) {
    throw new Error("The sales phone install link is not safe to encode.");
  }
  const { toDataURL } = await import("qrcode");
  return toDataURL(installUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 420,
    color: { dark: "#07110c", light: "#f4f1e8" },
  });
}
