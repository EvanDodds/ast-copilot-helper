/**
 * Test utilities for Tree-sitter state management
 * Handles cleanup and isolation between test files
 */

/**
 * Complete Tree-sitter state reset for test isolation
 * This function ensures each test file starts with a clean Tree-sitter environment
 */
export async function resetTreeSitterState(): Promise<void> {
  // Clear all Tree-sitter related modules from Node.js module cache
  if (typeof require !== "undefined" && require.cache) {
    const treeSitterKeys = Object.keys(require.cache).filter(
      (key) =>
        key.includes("tree-sitter") ||
        key.includes("node-gyp-build") ||
        key.includes("bindings") ||
        key.includes("node-addon-api"),
    );

    treeSitterKeys.forEach((key) => {
      delete require.cache[key];
    });
  }

  // Force multiple garbage collection cycles to clean up native module state
  if (global.gc) {
    // Run multiple GC cycles to ensure native objects are cleaned up
    for (let i = 0; i < 3; i++) {
      global.gc();
      // Small delay to allow native cleanup
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  // Additional cleanup for dynamic imports
  // Clear any internal Node.js import caches if possible
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node
  ) {
    // Give extra time for native module cleanup in Node.js
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

/**
 * Comprehensive test environment cleanup
 * Use this in afterEach hooks for complete isolation
 */
export async function cleanupTestEnvironment(): Promise<void> {
  await resetTreeSitterState();

  // Force final garbage collection
  if (global.gc) {
    global.gc();
  }

  // Final delay to ensure all cleanup is complete
  await new Promise((resolve) => setTimeout(resolve, 10));
}
