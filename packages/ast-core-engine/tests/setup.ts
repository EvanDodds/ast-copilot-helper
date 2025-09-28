/**
 * Test setup file for WASM integration tests
 *
 * This file provides common setup and utilities for testing both
 * NAPI and WASM build targets.
 */

// Mock for WASM module loading in test environment
global.fetch =
  global.fetch ||
  (async () => {
    throw new Error("WASM module loading not available in test environment");
  });

// Global test configuration
export const TEST_CONFIG = {
  WASM_AVAILABLE: false, // Set to true when WASM builds are working
  NAPI_AVAILABLE: true,
  MOCK_MODE: true,
};

// Helper to determine which build target to test
export function getBuildTarget(): "napi" | "wasm" | "mock" {
  if (TEST_CONFIG.WASM_AVAILABLE) {
    return "wasm";
  }
  if (TEST_CONFIG.NAPI_AVAILABLE) {
    return "napi";
  }
  return "mock";
}

// Setup for test environment
export function setupTestEnvironment() {
  // Configure test environment for AST operations
  process.env.NODE_ENV = "test";

  // Disable verbose logging during tests
  process.env.LOG_LEVEL = "error";
}

// Call setup immediately
setupTestEnvironment();
