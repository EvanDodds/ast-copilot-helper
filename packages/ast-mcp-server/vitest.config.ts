import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["node_modules/", "dist/"],
    environment: "node",
    globals: true,
    // Ensure tests run once and exit in CI/non-interactive environments
    watch: false,
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules/", "dist/", "src/**/*.d.ts", "src/**/__tests__/"],
    },
  },
});
