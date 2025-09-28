/**
 * TypeScript declarations for WASM bindings
 * Generated for ast-core-engine WebAssembly compilation target
 */

declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

/**
 * WASM-specific exports when compiled with wasm-pack
 * Note: These may differ from NAPI exports due to WASM limitations
 */
export interface WasmAstCoreEngineApi {
  // Core processing methods that work in WASM
  analyzeStructure(code: string, language: string): Promise<any>;
  validateSyntax(code: string, language: string): Promise<boolean>;

  // Note: Vector operations may be limited in WASM builds
  // Tree-sitter functionality not available in WASM
}

/**
 * WASM initialization function
 */
export function init(wasmPath?: string): Promise<void>;

/**
 * Feature detection for runtime capabilities
 */
export interface WasmFeatures {
  hasTreeSitter: false; // Always false for WASM builds
  hasVectorOps: boolean; // May be limited
  hasFileSystem: false; // No filesystem access in WASM
}

export function getWasmFeatures(): WasmFeatures;
