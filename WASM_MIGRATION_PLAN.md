# WebAssembly Migration Plan

## Why WASM Over NAPI-RS?

### Current Pain Points

- NAPI-RS CLI bugs preventing file generation
- Complex cross-platform binary management (.node files)
- Fragile build system requiring manual workarounds
- Platform-specific deployment complexity

### WASM Benefits for Your Use Case

- **Platform Independence**: Single .wasm file works everywhere
- **Simpler Build**: `wasm-pack build` vs complex NAPI-RS setup
- **Great Performance**: ~90% of native speed for vector operations
- **Browser Compatible**: Can run your engine in web contexts too
- **TypeScript Integration**: Auto-generated bindings
- **No Native Dependencies**: Eliminates .node file management

## Migration Steps

### Phase 1: Add WASM Build Target

```bash
# Add WASM target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack

# Add to Cargo.toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
js-sys = "0.3"
serde-wasm-bindgen = "0.4"
```

### Phase 2: Modify Rust Code

```rust
// Replace NAPI-RS annotations with wasm-bindgen
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct VectorDatabase {
    // Your existing SimpleVectorDb implementation
}

#[wasm_bindgen]
impl VectorDatabase {
    #[wasm_bindgen(constructor)]
    pub fn new(config: &JsValue) -> Self {
        // Convert JsValue to your config
    }

    #[wasm_bindgen]
    pub fn search_vectors(&self, query: &[f32], k: usize) -> JsValue {
        // Your existing search logic
        // Return results as JsValue
    }
}
```

### Phase 3: Build System Update

```json
// package.json
{
  "scripts": {
    "build:wasm": "wasm-pack build --target nodejs --out-dir pkg",
    "build": "npm run build:wasm && tsc"
  }
}
```

### Phase 4: TypeScript Integration

```typescript
// Auto-generated from wasm-pack
import init, { VectorDatabase } from "./pkg/ast_core_engine.js";

export class RustVectorDatabase implements VectorDatabase {
  private wasmDb: VectorDatabase;

  async initialize() {
    await init(); // Initialize WASM module
    this.wasmDb = new VectorDatabase(this.config);
  }

  async searchSimilar(vector: number[], k: number) {
    return this.wasmDb.search_vectors(new Float32Array(vector), k);
  }
}
```

## Performance Comparison

| Approach   | Build Complexity | Performance | Platform Support  | Deployment |
| ---------- | ---------------- | ----------- | ----------------- | ---------- |
| NAPI-RS    | High (fragile)   | 100%        | Platform binaries | Complex    |
| WASM       | Low              | ~90%        | Universal         | Simple     |
| Subprocess | Very Low         | ~85%        | Platform binaries | Medium     |

## Migration Timeline

1. **Week 1**: Add WASM build alongside existing NAPI-RS (parallel)
2. **Week 2**: Update vector database functions for WASM
3. **Week 3**: Update TypeScript integration layer
4. **Week 4**: Testing and performance validation
5. **Week 5**: Remove NAPI-RS dependencies

## Risk Mitigation

- Keep NAPI-RS working during migration
- A/B test performance between NAPI-RS and WASM
- Feature parity validation with existing test suite
- Gradual rollout (feature flags)

## Expected Outcomes

- ✅ 90% reduction in build complexity
- ✅ Single deployment artifact
- ✅ No more platform-specific binary management
- ✅ Future browser compatibility
- ❌ ~10% performance reduction (acceptable for vector search)
