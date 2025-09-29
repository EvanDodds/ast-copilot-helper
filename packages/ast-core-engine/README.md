# AST Core Engine

High-performance Rust core engine for AST processing, vector operations, and batch file handling.

## Features

- **Vector Database**: HNSW-based high-performance vector search
- **AST Processing**: Zero-copy Tree-sitter integration with parallel processing
- **Batch Processing**: Memory-efficient processing of 5000+ files
- **Storage Layer**: Async I/O optimized SQLite backend
- **Cross-Platform**: Native compilation for Windows, macOS, and Linux

## Installation

```bash
npm install @ast-copilot-helper/core-engine
```

## Usage

### NAPI (Native) Usage - Full Features

```typescript
import { AstCoreEngineApi, createDefaultEngine } from "@ast-helper/core-engine";

async function processFiles() {
  // Create engine instance (full functionality)
  const engine = await createDefaultEngine();

  // Process files with complete AST processing
  const result = await engine.processBatch(files, {
    maxMemoryMb: 1024,
    parallelWorkers: 4,
    batchSize: 100,
    vectorDimensions: 768,
    maxDepth: 10,
    includeUnnamedNodes: true,
    enableCaching: true,
  });

  console.log(`Processed ${result.processedFiles} files`);
}
```

### WASM (WebAssembly) Usage - Universal Compatibility

```typescript
import {
  init as initWasm,
  WasmAstCoreEngineApi,
  getWasmFeatures,
} from "@ast-helper/core-engine/wasm";

async function useWasmEngine() {
  // Initialize WASM engine (limited functionality)
  await initWasm();

  // Check available features
  const features = getWasmFeatures();
  console.log("WASM features:", features); // { hasTreeSitter: false, hasVectorOps: true, hasFileSystem: false }

  // Use WASM API (reduced functionality)
  const wasmEngine = new WasmAstCoreEngineApi();
  const result = await wasmEngine.analyzeStructure(code, "typescript");
}
```

### Dual Environment Support

```typescript
// Automatic selection based on environment
async function createEngine(preferWasm = false) {
  if (preferWasm || typeof window !== "undefined") {
    // Browser environment - use WASM
    const { init, WasmAstCoreEngineApi } = await import(
      "@ast-helper/core-engine/wasm"
    );
    await init();
    return new WasmAstCoreEngineApi();
  } else {
    // Node.js environment - use NAPI
    const { createDefaultEngine } = await import("@ast-helper/core-engine");
    return await createDefaultEngine();
  }
}
```

## Building

### Prerequisites

- Rust (latest stable)
- Node.js >= 16
- Platform-specific build tools

### NAPI Build (Native, Full Features)

```bash
# Development build
npm run build:debug

# Release build
npm run build
```

### WASM Build (Universal Compatibility)

Requires `wasm-pack`:

```bash
# Install wasm-pack (if not already installed)
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM package
npm run build:wasm

# Test WASM build
npm run test:wasm
```

### Dual Build (Both NAPI and WASM)

```bash
# Build both NAPI and WASM versions
npm run build:all

# Clean all build artifacts
npm run clean:all
```

### Testing

```bash
# Test NAPI build (requires Node.js runtime)
cargo test

# Test WASM build
npm run test:wasm

# Note: NAPI tests require Node.js runtime context
# Use yarn test:rust:all for comprehensive validation
```

## Performance Targets

- Vector search: <50ms for 100k+ vectors
- Batch processing: 5000+ files without memory throttling
- Memory usage: 50-70% reduction vs TypeScript implementation
- AST parsing: 2-5x faster with zero-copy optimizations

## Architecture

The engine supports dual compilation targets:

### NAPI Target (Default)

- **Rust Core**: Performance-critical computations with full feature access
- **Tree-sitter Integration**: Complete AST parsing for all supported languages
- **Vector Operations**: Full HNSW-based vector database functionality
- **NAPI-RS Bindings**: Zero-overhead Node.js integration
- **File System Access**: Direct file I/O operations

### WASM Target (Universal)

- **Rust Core**: Limited but universal WebAssembly compilation
- **Basic Analysis**: Syntax validation and basic structure analysis
- **Reduced Dependencies**: No tree-sitter (C library incompatible with WASM)
- **Browser Compatible**: Runs in web browsers and WASM-supporting environments
- **Sandboxed**: No file system access, pure computation

### Feature Comparison

| Feature           | NAPI                 | WASM         | Notes                          |
| ----------------- | -------------------- | ------------ | ------------------------------ |
| AST Parsing       | ✅ Full              | ❌ Limited   | WASM lacks tree-sitter support |
| Vector Operations | ✅ Full              | ⚠️ Reduced   | Basic vector math only         |
| File System       | ✅ Direct            | ❌ None      | WASM runs in sandbox           |
| Performance       | ✅ Native            | ⚠️ Good      | WASM ~80% of native speed      |
| Portability       | ❌ Platform-specific | ✅ Universal | WASM runs everywhere           |
| Bundle Size       | ❌ Large             | ✅ Small     | WASM optimized for size        |

## License

MIT
