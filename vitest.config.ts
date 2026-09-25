import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 15000,
    // Testovi dijele jednu lokalnu bazu, pa idu jedan po jedan.
    fileParallelism: false,
  },
});
