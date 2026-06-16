import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors the `@/` alias used in packages/web/vite.config.ts and
// packages/desktop/vite.config.ts so test files can import core modules the
// same way production code does. Pure-logic unit tests only need the `node`
// environment, so we default to it and avoid pulling in a jsdom dependency.
export default defineConfig({
  resolve: {
    alias: {
      "@/": `${path.resolve(__dirname, "packages/core/src")}/`,
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.{test,spec}.{ts,tsx}"],
  },
});
