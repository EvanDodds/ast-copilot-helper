// Global test setup
import { afterEach, beforeEach } from "vitest";

// Global setup for all tests
beforeEach(() => {
  // Setup before each test
});

afterEach(async () => {
  // Cleanup after each test

  // Clear any dynamically loaded modules (Tree-sitter parsers)
  if (typeof require !== "undefined" && require.cache) {
    // Clear any cached tree-sitter modules
    Object.keys(require.cache).forEach((key) => {
      if (key.includes("tree-sitter")) {
        delete require.cache[key];
      }
    });
  }

  // Add a small delay to allow any pending async operations to complete
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Force garbage collection if available to prevent memory leaks
  if (typeof global !== "undefined" && global.gc) {
    global.gc();
  }
});

// Set up global test environment
// Ensure process is available and properly initialized
if (typeof process !== "undefined" && process.env) {
  process.env.NODE_ENV = "test";
} else if (typeof globalThis !== "undefined") {
  // Fallback for environments where process might not be available
  globalThis.process = globalThis.process || {
    env: { NODE_ENV: "test" },
  };
}
