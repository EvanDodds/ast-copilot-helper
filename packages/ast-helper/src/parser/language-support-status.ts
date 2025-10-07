/**
 * Language Support Status Documentation
 *
 * This file documents the current status of Tree-sitter language support
 * for native-only parsing (WASM support has been removed).
 */

/**
 * Language Support Categories (Native-Only Architecture)
 */
export const LANGUAGE_SUPPORT_STATUS = {
  // Tier 1: Full Native Support (working with native Tree-sitter)
  NATIVE_WORKING: [
    {
      language: "javascript",
      status: "✅ Native parser working",
      moduleStructure: "default.language property available",
      notes: "Full compatibility with Tree-sitter native parsing",
    },
    {
      language: "python",
      status: "✅ Native parser working",
      moduleStructure: "default.language property available",
      notes: "Full compatibility with Tree-sitter native parsing",
    },
  ],

  // Tier 2: Special Native Support (working but with unique structure)
  NATIVE_SPECIAL: [
    {
      language: "typescript",
      status: "✅ Native parser working (special structure)",
      moduleStructure: "default.typescript property (not default.language)",
      notes: "Requires special handling due to typescript/tsx structure",
    },
  ],

  // Tier 3: Limited Native Support (may require additional work)
  NATIVE_LIMITED: [
    {
      language: "java",
      status: "⚠️ Native support needs verification",
      moduleStructure:
        "May require grammar module updates for native compatibility",
      notes: "Previously WASM-only, needs native compatibility testing",
    },
    {
      language: "csharp",
      status: "⚠️ Native support needs verification",
      moduleStructure:
        "May require grammar module updates for native compatibility",
      notes: "Previously WASM-only, needs native compatibility testing",
    },
    {
      language: "go",
      status: "⚠️ Native support needs verification",
      moduleStructure:
        "May require grammar module updates for native compatibility",
      notes: "Previously WASM-only, needs native compatibility testing",
    },
    {
      language: "rust",
      status: "⚠️ Native support needs verification",
      moduleStructure:
        "May require grammar module updates for native compatibility",
      notes: "Previously WASM-only, needs native compatibility testing",
    },
    {
      language: "c",
      status: "⚠️ Native support needs verification",
      moduleStructure:
        "May require grammar module updates for native compatibility",
      notes: "Previously WASM-only, needs native compatibility testing",
    },
    {
      language: "cpp",
      status: "⚠️ Native support needs verification",
      moduleStructure:
        "May require grammar module updates for native compatibility",
      notes: "Previously WASM-only, needs native compatibility testing",
    },
  ],

  // Tier 4: Not Yet Tested (packages not installed)
  NOT_YET_TESTED: [
    "php",
    "ruby",
    "kotlin",
    "swift",
    "dart",
    "scala",
    "lua",
    "bash",
  ],
};

/**
 * Implementation Status Summary (Native-Only Architecture)
 */
export const IMPLEMENTATION_STATUS = {
  nativeWorkingCount: 3, // JavaScript, Python, TypeScript (special)
  nativeLimitedCount: 6, // Java, C#, Go, Rust, C, C++ (need native verification)
  totalTestedCount: 9,

  // Current capabilities (native-only)
  capabilities: {
    nativeParsing: "✅ Implemented with native Tree-sitter only",
    errorHandling: "✅ Comprehensive error diagnostics implemented",
    cacheManagement: "✅ Grammar caching and integrity verification",
    languageDetection: "✅ File extension based detection",
    wasmSupport: "❌ Removed - native-only architecture",
  },

  // Next steps for full native language support
  nextSteps: [
    "Verify native compatibility for previously WASM-only languages",
    "Add remaining language packages (PHP, Ruby, Kotlin, etc.)",
    "Test native parsing with all grammar modules",
    "Add language-specific parsing optimizations for native runtime",
    "Update grammar module dependencies to ensure native compatibility",
  ],
};

export default {
  LANGUAGE_SUPPORT_STATUS,
  IMPLEMENTATION_STATUS,
};
