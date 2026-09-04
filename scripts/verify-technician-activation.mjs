// Local-only browser regression check. Never uses a real invitation.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = "http://localhost:3013";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  for (const javaScriptEnabled of [true, false]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled });
  await page.goto(`${base}/tech/access?token=${"a".repeat(43)}`);
  const responsePromise = page.waitForResponse(r => r.url().includes("/api/field/access/claim"));
  await page.getByRole("button", { name: "Activate my workspace" }).click();
  const response = await responsePromise;
  const request = response.request();
  const headers = await request.allHeaders();
  console.log(JSON.stringify({ javaScriptEnabled, status: response.status(), origin: headers.origin, fetchSite: headers["sec-fetch-site"], destination: headers["sec-fetch-dest"] }));
  if (process.env.EXPECT_ORIGIN_FIX === "1") {
    assert.equal(response.status(), 303, "Invalid synthetic token should reach validation, not fail origin protection");
    assert.equal(headers.origin, base);
    assert.equal(headers.referer, `${base}/`, "Only origin, never the private invitation URL, may be sent as referrer");
    await page.getByText(/That install link is invalid/).waitFor();
  }
  await page.close();
  }
} finally { await browser.close(); }
