/**
 * Language Support Status Documentation
 *
 * This file documents the current status of Tree-sitter language support
 * based on parser module compatibility testing.
 */

/**
 * Language Support Categories
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

  // Tier 3: WASM-Only Support (native modules lack 'language' property)
  WASM_ONLY: [
    {
      language: "java",
      status: "🔄 WASM fallback only",
      moduleStructure:
        "default.name and default.nodeTypeInfo (no language property)",
      notes: "Native module incompatible, requires WASM parsing",
    },
    {
      language: "csharp",
      status: "🔄 WASM fallback only",
      moduleStructure:
        "default.name and default.nodeTypeInfo (no language property)",
      notes: "Native module incompatible, requires WASM parsing",
    },
    {
      language: "go",
      status: "🔄 WASM fallback only",
      moduleStructure:
        "default.name and default.nodeTypeInfo (no language property)",
      notes: "Native module incompatible, requires WASM parsing",
    },
    {
      language: "rust",
      status: "🔄 WASM fallback only",
      moduleStructure:
        "default.name and default.nodeTypeInfo (no language property)",
      notes: "Native module incompatible, requires WASM parsing",
    },
    {
      language: "c",
      status: "🔄 WASM fallback only",
      moduleStructure:
        "default.name and default.nodeTypeInfo (no language property)",
      notes: "Native module incompatible, requires WASM parsing",
    },
    {
      language: "cpp",
      status: "🔄 WASM fallback only",
      moduleStructure:
        "default.name and default.nodeTypeInfo (no language property)",
      notes: "Native module incompatible, requires WASM parsing",
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
 * Implementation Status Summary
 */
export const IMPLEMENTATION_STATUS = {
  nativeWorkingCount: 3, // JavaScript, Python, TypeScript (special)
  wasmOnlyCount: 6, // Java, C#, Go, Rust, C, C++
  totalTestedCount: 9,

  // Current capabilities
  capabilities: {
    nativeParsing: "✅ Implemented with dual-method fallback",
    wasmFallback: "✅ Implemented with web-tree-sitter",
    errorHandling: "✅ Comprehensive error diagnostics implemented",
    cacheManagement: "✅ Grammar caching and integrity verification",
    languageDetection: "✅ File extension based detection",
  },

  // Next steps for full language support
  nextSteps: [
    "Add remaining language packages (PHP, Ruby, Kotlin, etc.)",
    "Test WASM parsing with actual grammar files",
    "Optimize WASM loading performance",
    "Add language-specific parsing optimizations",
  ],
};

export default {
  LANGUAGE_SUPPORT_STATUS,
  IMPLEMENTATION_STATUS,
};
