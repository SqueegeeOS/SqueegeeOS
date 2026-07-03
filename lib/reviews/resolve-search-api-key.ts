import { getGoogleMapsApiKey } from "@/lib/reviews/config";

export type GoogleSearchApiKeySource = "wizard" | "server_env" | "none";

export function resolveSearchApiKey(wizardKey?: string): {
  apiKey: string;
  source: GoogleSearchApiKeySource;
  serverEnvKeyPresent: boolean;
  wizardKeyPresent: boolean;
} {
  const wizard = wizardKey?.trim() ?? "";
  const server = getGoogleMapsApiKey() ?? "";

  if (wizard) {
    return {
      apiKey: wizard,
      source: "wizard",
      serverEnvKeyPresent: Boolean(server),
      wizardKeyPresent: true,
    };
  }

  if (server) {
    return {
      apiKey: server,
      source: "server_env",
      serverEnvKeyPresent: true,
      wizardKeyPresent: false,
    };
  }

  return {
    apiKey: "",
    source: "none",
    serverEnvKeyPresent: false,
    wizardKeyPresent: Boolean(wizard),
  };
}
