# NAPI to WASM Migration Analysis

## Current NAPI Implementation Structure

### Core Vector Database Functions

#### 1. `init_vector_database(config: HnswConfig) -> napi::Result<String>`

- **NAPI Annotation:** `#[napi]`
- **Parameters:** `HnswConfig` struct (NAPI object)
- **Return:** `napi::Result<String>` with success message
- **Key Dependencies:**
  - `napi::Error` for error handling
  - `OnceLock` for global singleton pattern
  - Configuration validation with detailed error messages

#### 2. `add_vector_to_db(node_id: String, embedding_json: String, metadata: VectorMetadata) -> napi::Result<String>`

- **NAPI Annotation:** `#[napi]`
- **Parameters:**
  - `node_id: String`
  - `embedding_json: String` (JSON-encoded `Vec<f32>`)
  - `metadata: VectorMetadata` (NAPI object)
- **Return:** `napi::Result<String>` with success message
- **Key Dependencies:**
  - JSON parsing with `serde_json::from_str`
  - `napi::Error` for error propagation

#### 3. `search_vectors(query_embedding_json: String, k: u32, ef_search: Option<u32>) -> napi::Result<Vec<SearchResult>>`

- **NAPI Annotation:** `#[napi]`
- **Parameters:**
  - `query_embedding_json: String` (JSON-encoded `Vec<f32>`)
  - `k: u32` (number of results)
  - `ef_search: Option<u32>` (search parameter)
- **Return:** `napi::Result<Vec<SearchResult>>` (array of NAPI objects)
- **Key Dependencies:**
  - JSON parsing for query embedding
  - `SearchResult` struct conversion

#### 4. `get_vector_count() -> napi::Result<u32>`

- **NAPI Annotation:** `#[napi]`
- **Parameters:** None
- **Return:** `napi::Result<u32>`
- **Key Dependencies:** Minimal

#### 5. `clear_vector_database() -> napi::Result<String>`

- **NAPI Annotation:** `#[napi]`
- **Parameters:** None
- **Return:** `napi::Result<String>` with success message
- **Key Dependencies:** Minimal

### Data Types and Structures

#### NAPI-Specific Types

1. **HnswConfig** - `#[napi(object)]`
   - `embedding_dimension: u32`
   - `m: u32`
   - `ef_construction: u32`
   - `ef_search: u32`
   - `max_elements: u32`

2. **VectorMetadata** - `#[napi(object)]`
   - `node_id: String`
   - `file_path: String`
   - `node_type: String`
   - `signature: String`
   - `language: String`
   - `embedding_model: String`
   - `timestamp: u32`

3. **SearchResult** - `#[napi(object)]`
   - `node_id: String`
   - `file_path: String`
   - `node_type: String`
   - `similarity: f64`
   - `distance: f64`

### Error Handling Patterns

#### Current NAPI Error Handling

- Uses `napi::Result<T>` return types
- `napi::Error::from_reason(String)` for custom errors
- Error propagation with `.map_err(|e| napi::Error::from_reason(e.to_string()))`
- Detailed validation errors with configuration constraints

### Memory Management

#### Current Approach

- Global singleton using `OnceLock<SimpleVectorDb>`
- `Arc<DashMap<String, (Vec<f32>, VectorMetadata)>>` for thread-safe storage
- Automatic memory management through Rust's ownership system
- No explicit cleanup required for NAPI

### Data Serialization

#### Current Serialization Strategy

- Vector embeddings passed as JSON strings (`Vec<f32>` → JSON → String)
- Complex objects (metadata, search results) handled by NAPI object mapping
- Automatic serialization/deserialization for NAPI objects
- JSON parsing for embeddings with error handling

### Configuration and Features

#### Cargo.toml Configuration

- Feature flags: `napi-backend`, `full-deps`
- Conditional compilation with `#[cfg(not(feature = "wasm"))]`
- NAPI dependencies: `napi = "2.16"`, `napi-derive = "2.16"`
- Build script: `napi-build = "2.1"`

## Migration Requirements for WASM

### 1. Annotation Changes

- Replace `#[napi]` with `#[wasm_bindgen]`
- Replace `#[napi(object)]` with appropriate WASM bindings

### 2. Error Type Changes

- Replace `napi::Result<T>` with `Result<T, JsValue>`
- Replace `napi::Error` with `JsValue` or custom WASM error types

### 3. Data Type Conversions

- `Vec<f32>` → `Float32Array` (or `js_sys::Float32Array`)
- Complex objects → JSON serialization with `serde-wasm-bindgen`
- String handling remains similar

### 4. Memory Management Considerations

- Global singleton pattern may need adjustment for WASM context
- Consider `wasm-bindgen` memory management best practices
- Handle JavaScript garbage collection interactions

### 5. Build Configuration

- Add WASM feature flags
- Configure `wasm-bindgen` dependencies
- Set up WASM compilation targets

## Risk Assessment

### Low Risk

- Basic function signatures and logic remain largely unchanged
- Data structures are already serializable
- Error handling patterns are established

### Medium Risk

- Global singleton pattern compatibility with WASM
- Memory management between Rust and JavaScript
- Performance optimization for WASM constraints

### High Risk

- TypeScript definition generation and compatibility
- JavaScript array/buffer handling
- Build system integration complexity
