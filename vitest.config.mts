import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the "@/*" alias from tsconfig.json natively — no extra plugin.
  resolve: { tsconfigPaths: true },
  test: {
    // Node environment only: the tested modules are the pure domain layer
    // (markdown conversion, document validation, access rules, upload gating).
    // No DOM is required, which keeps the suite fast enough to run on every save.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
