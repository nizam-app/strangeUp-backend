import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
    setupFiles: ["tests/setup/unit.setup.ts"],
    testTimeout: 15_000,
  },
});
