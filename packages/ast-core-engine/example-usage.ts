/**
 * Example: Dual NAPI/WASM usage pattern for ast-core-engine
 *
 * This demonstrates how to use both NAPI (native) and WASM builds
 * depending on the environment and requirements.
 */

// NAPI (native) usage - full functionality
import { AstCoreEngineApi, createDefaultEngine } from "ast-core-engine";

// WASM usage - limited functionality but universal compatibility
import {
  init as initWasm,
  WasmAstCoreEngineApi,
  getWasmFeatures,
} from "ast-core-engine/wasm";

/**
 * Runtime engine selection based on environment and requirements
 */
export async function createEngine(
  preferWasm = false,
): Promise<AstCoreEngineApi | WasmAstCoreEngineApi> {
  if (preferWasm || typeof window !== "undefined") {
    // Browser environment or WASM explicitly requested
    await initWasm();

    const _features = getWasmFeatures();

    // Return WASM API (limited functionality)
    return {
      analyzeStructure: async (code: string, _language: string) => {
        // WASM implementation - no tree-sitter
        return { type: "basic", language: _language, hasTreeSitter: false };
      },
      validateSyntax: async (code: string, _language: string) => {
        // Basic syntax validation without tree-sitter
        return code.length > 0;
      },
    };
  } else {
    // Node.js environment - use full NAPI functionality
    return createDefaultEngine();
  }
}

/**
 * Example usage demonstrating feature detection
 */
export async function exampleUsage() {
  const code = `
    function hello(name: string) {
      return \`Hello, \${name}!\`;
    }
  `;

  // Try NAPI first, fallback to WASM
  try {
    const engine = await createEngine(false);

    if ("hasVectorOps" in engine) {
      // This is the WASM API
      const result = await engine.analyzeStructure(code, "typescript");
      return result;
    } else {
      // This is the NAPI API
      const result = await (engine as AstCoreEngineApi).analyzeStructure(
        code,
        "typescript",
      );
      return result;
    }
  } catch (error) {
    // Fallback to WASM
    const wasmEngine = await createEngine(true);
    const result = await wasmEngine.analyzeStructure(code, "typescript");
    return result;
  }
}
