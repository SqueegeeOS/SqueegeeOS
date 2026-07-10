import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    setupFiles: ["./test/setup/polyfill-websocket.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js aliases "server-only" to a no-op in its RSC-aware webpack
      // build; Vitest has no such boundary, so stub it the same way here.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.js"),
    },
  },
});
