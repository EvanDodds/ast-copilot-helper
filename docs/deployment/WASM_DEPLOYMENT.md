# WASM Deployment Guide

This guide covers deploying AST Copilot Helper's WebAssembly (WASM) builds for universal compatibility across different environments.

## Overview

The `@ast-helper/core-engine` package supports dual compilation targets:

- **NAPI**: Native Node.js bindings for maximum performance
- **WASM**: WebAssembly for universal compatibility (browsers, edge computing, etc.)

## Quick Start

### Install Dependencies

```bash
# Install wasm-pack (global installation)
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Or with npm
npm install -g wasm-pack
```

### Build WASM Package

```bash
cd packages/ast-core-engine

# Build WASM package for Node.js
npm run build:wasm
```

This generates:

- `pkg/` directory with WASM bindings
- `pkg/package.json` with package metadata
- `pkg/*.js` - JavaScript bindings
- `pkg/*.wasm` - WebAssembly binary
- `pkg/*.d.ts` - TypeScript definitions

## Environment-Specific Deployment

### Node.js Applications

```typescript
// WASM-first architecture
import { VectorDatabaseFactory } from "@ast-helper/core-engine";

const vectorDb = await VectorDatabaseFactory.create(); // Uses WASM by default
```

### Browser Applications

```typescript
// Force WASM usage
import { createEngine } from "@ast-helper/core-engine/example-usage";

const engine = await createEngine(true); // Forces WASM
```

### Edge Computing (Cloudflare Workers, Vercel Edge)

```typescript
import {
  init as initWasm,
  WasmAstCoreEngineApi,
} from "@ast-helper/core-engine/wasm";

// Initialize WASM in edge environment
await initWasm();
const engine = new WasmAstCoreEngineApi();

// Use limited but fast functionality
const result = await engine.analyzeStructure(code, "typescript");
```

## Feature Compatibility

| Feature           | NAPI                 | WASM             | Notes                        |
| ----------------- | -------------------- | ---------------- | ---------------------------- |
| AST Parsing       | ✅ Full tree-sitter  | ❌ Basic only    | Tree-sitter uses C libraries |
| Vector Operations | ✅ Full HNSW         | ⚠️ Limited       | Basic vector math only       |
| File System       | ✅ Direct access     | ❌ Sandboxed     | WASM security model          |
| Performance       | ✅ 100% native       | ⚡ ~80% native   | JIT compilation overhead     |
| Bundle Size       | ❌ Platform-specific | ✅ ~2-5MB        | Optimized for size           |
| Startup Time      | ⚡ Immediate         | ⚠️ Init required | WASM instantiation           |

## Build Configuration

### Custom WASM Build

```bash
# Build with specific features
wasm-pack build --target nodejs --features "wasm,vector-ops" --scope ast-helper

# Browser target (different from Node.js)
wasm-pack build --target web --features "wasm,basic-analysis"

# Bundle size optimization
wasm-pack build --target nodejs --release --features "wasm" -- --features "size-opt"
```

### CI/CD Integration

The WASM build is automatically included in the CI pipeline:

```yaml
# .github/workflows/ci.yml (excerpt)
build-wasm:
  name: Build WASM Bindings
  runs-on: ubuntu-latest
  steps:
    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: wasm32-unknown-unknown

    - name: Install wasm-pack
      run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

    - name: Build WASM package
      run: wasm-pack build --target nodejs --features wasm
```

## Troubleshooting

### Common Issues

#### 1. WASM Module Not Found

```bash
Error: Cannot find module '@ast-helper/core-engine/wasm'
```

**Solution**: Ensure WASM package is built:

```bash
cd packages/ast-core-engine && npm run build:wasm
```

#### 2. Tree-sitter Not Available

```typescript
// This will fail in WASM
await engine.parseAstTree(code, "typescript"); // ❌ Tree-sitter not available

// Use basic analysis instead
await engine.analyzeStructure(code, "typescript"); // ✅ Basic parsing works
```

#### 3. Performance Slower Than Expected

WASM performance depends on:

- **JIT Compilation**: First run is slower, subsequent runs are optimized
- **Memory Access**: Frequent JS-WASM boundary crossings add overhead
- **Feature Set**: Limited WASM build trades features for compatibility

**Optimization tips**:

```typescript
// Batch operations to reduce boundary crossings
const results = await Promise.all([
  engine.analyzeStructure(code1, "typescript"),
  engine.analyzeStructure(code2, "typescript"),
  engine.analyzeStructure(code3, "typescript"),
]);

// Prefer NAPI for CPU-intensive workloads when available
if (typeof window === "undefined") {
  // Use NAPI in Node.js
  const napiEngine = await createDefaultEngine();
}
```

### Debugging WASM Builds

Enable debug information:

```bash
# Build with debug symbols
wasm-pack build --target nodejs --dev --features wasm

# Inspect WASM module
wasm-objdump -x pkg/*.wasm
```

Check feature detection:

```typescript
import { getWasmFeatures } from "@ast-helper/core-engine/wasm";

const features = getWasmFeatures();
console.log("Available features:", features);
// { hasTreeSitter: false, hasVectorOps: true, hasFileSystem: false }
```

## Performance Benchmarks

### Startup Time

| Target | Cold Start | Warm Start |
| ------ | ---------- | ---------- |
| NAPI   | ~5ms       | ~1ms       |
| WASM   | ~50ms      | ~10ms      |

### Processing Speed (1000 small files)

| Target | Time | Memory |
| ------ | ---- | ------ |
| NAPI   | 1.2s | 45MB   |
| WASM   | 1.5s | 52MB   |

### Bundle Size Impact

| Component    | NAPI             | WASM    | Notes                          |
| ------------ | ---------------- | ------- | ------------------------------ |
| Binary       | 15-25MB          | 3-5MB   | Platform-specific vs universal |
| Dependencies | Full tree-sitter | Minimal | Reduced dependency tree        |
| Total        | 40-60MB          | 8-12MB  | Including all dependencies     |

## Best Practices

### 1. Environment Detection

```typescript
function isWasmEnvironment(): boolean {
  // Browser environment
  if (typeof window !== "undefined") return true;

  // Edge computing environments
  if (typeof EdgeRuntime !== "undefined") return true;

  // Explicitly requested
  if (process.env.FORCE_WASM === "true") return true;

  return false;
}
```

### 2. Progressive Enhancement

```typescript
async function createOptimalEngine() {
  try {
    // Try NAPI first for best performance
    if (!isWasmEnvironment()) {
      const { createDefaultEngine } = await import("@ast-helper/core-engine");
      return await createDefaultEngine();
    }
  } catch (error) {
    console.warn("NAPI not available, falling back to WASM");
  }

  // Fallback to WASM
  const { init, WasmAstCoreEngineApi } = await import(
    "@ast-helper/core-engine/wasm"
  );
  await init();
  return new WasmAstCoreEngineApi();
}
```

### 3. Feature Detection

```typescript
interface EngineCapabilities {
  canParseAst: boolean;
  canProcessVectors: boolean;
  canAccessFiles: boolean;
  estimatedPerformance: "native" | "good" | "limited";
}

function getEngineCapabilities(engine: any): EngineCapabilities {
  if ("hasVectorOps" in engine) {
    // WASM engine
    const features = engine.getWasmFeatures();
    return {
      canParseAst: false,
      canProcessVectors: features.hasVectorOps,
      canAccessFiles: false,
      estimatedPerformance: "good",
    };
  } else {
    // NAPI engine
    return {
      canParseAst: true,
      canProcessVectors: true,
      canAccessFiles: true,
      estimatedPerformance: "native",
    };
  }
}
```

## Security Considerations

### WASM Security Model

WASM runs in a secure sandbox with:

- **No file system access**: Cannot read/write files directly
- **No network access**: Cannot make HTTP requests
- **Limited memory**: Fixed memory allocation
- **No native libraries**: Cannot load C libraries like tree-sitter

### Deployment Security

```typescript
// Safe: Basic computation in WASM
const result = await wasmEngine.analyzeStructure(userCode, "typescript");

// Unsafe: Don't pass sensitive data to user-controlled WASM
// const secrets = await wasmEngine.processSecrets(userInput); // ❌
```

## Migration Guide

### From Pure TypeScript

```diff
// Before
- import { Parser } from './typescript-parser';
- const parser = new Parser();

// After
+ import { createEngine } from '@ast-helper/core-engine/example-usage';
+ const engine = await createEngine();
```

### From NAPI-Only

```diff
// Before
- import { createDefaultEngine } from '@ast-helper/core-engine';
- const engine = await createDefaultEngine();

// After
+ import { createEngine } from '@ast-helper/core-engine/example-usage';
+ const engine = await createEngine(); // Automatically selects NAPI or WASM
```

For complete migration examples, see [examples/](../examples/) directory.
