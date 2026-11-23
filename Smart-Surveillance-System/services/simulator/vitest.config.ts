import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // threads: no child-process signals needed, works in restricted sandboxes/CI
    pool: "threads",
  },
});
