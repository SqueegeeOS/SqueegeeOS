import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { SiteNavigation } from "@/components/navigation/site-navigation";
import { AppPricingSettingsProvider } from "@/components/pricing/app-pricing-settings-provider";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { pwaConfig } from "@/lib/pwa/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

function resolveMetadataBase(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      console.warn(
        "[metadata] NEXT_PUBLIC_APP_URL is invalid; using the deployment URL",
      );
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  return new URL(vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: CUSTOMER_BRAND.name,
  description: pwaConfig.description,
  applicationName: pwaConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: pwaConfig.shortName,
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: [{ url: "/icons/icon-192x192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: pwaConfig.themeColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden">
        <AppPricingSettingsProvider>
          <SiteNavigation />
          {children}
        </AppPricingSettingsProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
