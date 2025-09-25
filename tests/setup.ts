// Global test setup
import { afterEach, beforeEach } from "vitest";

// Global setup for all tests
beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
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
