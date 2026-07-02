/** Shared PWA configuration for Squeegeeking / SqueegeeOS */
export const pwaConfig = {
  name: "Squeegeeking",
  shortName: "Squeegeeking",
  description: "Premium Home Care.",
  themeColor: "#060606",
  backgroundColor: "#060606",
  startUrl: "/",
  display: "standalone" as const,
} as const;
