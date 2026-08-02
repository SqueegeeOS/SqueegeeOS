import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { SiteNavigation } from "@/components/navigation/site-navigation";
import { AppPricingSettingsProvider } from "@/components/pricing/app-pricing-settings-provider";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { PUBLIC_SITE_URL } from "@/lib/brand/urls";
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

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: {
    default: "SqueegeeKing | Window Cleaning in Chico, CA",
    template: "%s | SqueegeeKing",
  },
  description:
    "Window cleaning, pressure washing, solar panel cleaning, and recurring exterior home care for Chico, California homeowners.",
  applicationName: CUSTOMER_BRAND.name,
  creator: CUSTOMER_BRAND.name,
  publisher: CUSTOMER_BRAND.name,
  category: "Home services",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: CUSTOMER_BRAND.name,
    url: "/",
    title: "SqueegeeKing | Window Cleaning in Chico, CA",
    description:
      "Window cleaning, pressure washing, solar panel cleaning, and recurring exterior home care for Chico, California homeowners.",
    images: [
      {
        url: "/day/morning.jpg",
        width: 1376,
        height: 768,
        alt: "A cared-for Chico home in warm morning light",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SqueegeeKing | Window Cleaning in Chico, CA",
    description:
      "Exterior home care in Chico, California—done the right way.",
    images: ["/day/morning.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-xl transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        <AppPricingSettingsProvider>
          <SiteNavigation />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </AppPricingSettingsProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
