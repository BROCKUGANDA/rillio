import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest configuration for Rillio.
 *
 * Unit/property tests run in a Node environment against pure domain modules
 * (money math, categorization precedence, CSV normalization, goal projection,
 * wallet challenge/verify, rate limiting). They never touch the network or a
 * real chain; provider/RPC adapters are exercised through injected fakes.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**"],
      exclude: ["src/lib/**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});