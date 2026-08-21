import type { NextConfig } from "next";

const supabaseImageHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
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
      {
        source: "/brand/homeatlas-member-loader-v1.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
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
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      ...(supabaseImageHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseImageHostname,
              pathname: "/storage/v1/object/sign/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
