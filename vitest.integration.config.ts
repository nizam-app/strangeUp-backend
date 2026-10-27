import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/integration.setup.ts"],
    globalSetup: ["tests/setup/integration-global-setup.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
