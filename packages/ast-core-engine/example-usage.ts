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
    console.log("Initializing WASM engine...");
    await initWasm();

    const features = getWasmFeatures();
    console.log("WASM features:", features);

    // Return WASM API (limited functionality)
    return {
      analyzeStructure: async (code: string, language: string) => {
        // WASM implementation - no tree-sitter
        console.warn("WASM build: Limited AST analysis without tree-sitter");
        return { type: "basic", language, hasTreeSitter: false };
      },
      validateSyntax: async (code: string, language: string) => {
        // Basic syntax validation without tree-sitter
        return code.length > 0;
      },
    };
  } else {
    // Node.js environment - use full NAPI functionality
    console.log("Using NAPI engine...");
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
      console.log("Using WASM engine (limited features)");
      const result = await engine.analyzeStructure(code, "typescript");
      console.log("WASM analysis:", result);
    } else {
      // This is the NAPI API
      console.log("Using NAPI engine (full features)");
      const result = await (engine as AstCoreEngineApi).analyzeStructure(
        code,
        "typescript",
      );
      console.log("NAPI analysis:", result);
    }
  } catch (error) {
    console.error("Engine initialization failed:", error);

    // Fallback to WASM
    console.log("Falling back to WASM...");
    const wasmEngine = await createEngine(true);
    const result = await wasmEngine.analyzeStructure(code, "typescript");
    console.log("WASM fallback result:", result);
  }
}
