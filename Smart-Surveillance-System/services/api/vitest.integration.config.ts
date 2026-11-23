import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.integration.ts"],
    pool: "threads",
    testTimeout: 30_000,
  },
});
