import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const privateRouteHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const privateRoutePatterns = [
  "/hq/:path*",
  "/employee/:path*",
  "/tech/:path*",
  "/presentations/:path*",
  "/portal/:path*",
  "/homecare/:path*",
  "/properties/:path*",
  "/setup/:path*",
  "/experience/:path*",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...privateRoutePatterns.map((source) => ({
        source,
        headers: privateRouteHeaders,
      })),
    ];
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/hq", permanent: true },
      { source: "/admin/our-story", destination: "/hq/our-story", permanent: true },
      { source: "/hq/membership", destination: "/hq/memberships", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
