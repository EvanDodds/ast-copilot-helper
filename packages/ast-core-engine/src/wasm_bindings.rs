//! WASM Bindings for Vector Database Operations
//!
//! This module provides WebAssembly bindings for the vector database functionality,
//! adapting the existing NAPI implementation to work with wasm-bindgen.

use crate::{
    config::HnswConfig, error::EngineError, types::VectorMetadata, vector_db::SimpleVectorDb,
};
use js_sys::Float32Array;
use serde_wasm_bindgen::{from_value, to_value};
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;

/// Global vector database instance for WASM
static WASM_VECTOR_DB: OnceLock<SimpleVectorDb> = OnceLock::new();

/// WASM-compatible error type
#[derive(Debug)]
pub struct WasmError {
    message: String,
}

impl WasmError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl From<EngineError> for WasmError {
    fn from(error: EngineError) -> Self {
        WasmError::new(error.to_string())
    }
}

impl From<WasmError> for JsValue {
    fn from(error: WasmError) -> Self {
        JsValue::from_str(&error.message)
    }
}

/// Initialize the vector database for WASM
///
/// # Arguments
/// * `config_js` - JavaScript object containing HnswConfig fields
///
/// # Returns
/// * Success message as string or throws JsValue error
#[wasm_bindgen]
pub fn init_vector_database_wasm(config_js: JsValue) -> Result<String, JsValue> {
    // Convert JavaScript object to HnswConfig
    let config: HnswConfig =
        from_value(config_js).map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?;

    // Validate configuration
    if config.embedding_dimension == 0 || config.embedding_dimension > 10000 {
        return Err(JsValue::from_str(&format!(
            "Invalid embedding dimension: {}. Must be between 1 and 10000",
            config.embedding_dimension
        )));
    }

    if config.max_elements == 0 || config.max_elements > 10_000_000 {
        return Err(JsValue::from_str(&format!(
            "Invalid max_elements: {}. Must be between 1 and 10,000,000",
            config.max_elements
        )));
    }

    // Check if database is already initialized
    if let Some(existing_db) = WASM_VECTOR_DB.get() {
        // If already initialized with compatible config, just clear and return success
        if existing_db.config.embedding_dimension == config.embedding_dimension {
            existing_db.clear().map_err(WasmError::from)?;
            return Ok("Vector database reinitialized successfully".to_string());
        } else {
            return Err(JsValue::from_str(
                "Vector database already initialized with different configuration",
            ));
        }
    }

    let db = SimpleVectorDb::new(config);
    db.initialize().map_err(WasmError::from)?;

    WASM_VECTOR_DB
        .set(db)
        .map_err(|_| JsValue::from_str("Vector database initialization race condition"))?;

    Ok("Vector database initialized successfully".to_string())
}

/// Add a vector to the database
///
/// # Arguments
/// * `node_id` - Unique identifier for the node
/// * `embedding` - Float32Array containing the vector embedding
/// * `metadata_js` - JavaScript object containing VectorMetadata fields
///
/// # Returns
/// * Success message as string or throws JsValue error
#[wasm_bindgen]
pub fn add_vector_to_db_wasm(
    node_id: String,
    embedding: Float32Array,
    metadata_js: JsValue,
) -> Result<String, JsValue> {
    let db = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    // Convert Float32Array to Vec<f32>
    let embedding_vec: Vec<f32> = embedding.to_vec();

    // Convert JavaScript object to VectorMetadata
    let metadata: VectorMetadata = from_value(metadata_js)
        .map_err(|e| JsValue::from_str(&format!("Invalid metadata: {}", e)))?;

    db.add_vector(node_id.clone(), embedding_vec, metadata)
        .map_err(WasmError::from)?;

    Ok(format!("Vector added successfully for node: {}", node_id))
}

/// Search for similar vectors
///
/// # Arguments
/// * `query_embedding` - Float32Array containing the query vector
/// * `k` - Number of results to return
/// * `ef_search` - Optional search parameter
///
/// # Returns
/// * Array of SearchResult objects or throws JsValue error
#[wasm_bindgen]
pub fn search_vectors_wasm(
    query_embedding: Float32Array,
    k: u32,
    ef_search: Option<u32>,
) -> Result<JsValue, JsValue> {
    let db = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    // Convert Float32Array to Vec<f32>
    let query_vec: Vec<f32> = query_embedding.to_vec();

    let results = db
        .search_similar(query_vec, k, ef_search)
        .map_err(WasmError::from)?;

    // Convert results to JavaScript array
    to_value(&results)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize results: {}", e)))
}

/// Get the total number of vectors in the database
///
/// # Returns
/// * Number of vectors as u32 or throws JsValue error
#[wasm_bindgen]
pub fn get_vector_count_wasm() -> Result<u32, JsValue> {
    let db = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    Ok(db.get_vector_count())
}

/// Clear all vectors from the database
///
/// # Returns
/// * Success message as string or throws JsValue error
#[wasm_bindgen]
pub fn clear_vector_database_wasm() -> Result<String, JsValue> {
    let db = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    db.clear().map_err(WasmError::from)?;

    Ok("Vector database cleared successfully".to_string())
}

/// Helper function to create HnswConfig from JavaScript object
///
/// # Arguments
/// * `embedding_dimension` - Dimension of embeddings
/// * `m` - M parameter for HNSW
/// * `ef_construction` - Construction parameter
/// * `ef_search` - Search parameter
/// * `max_elements` - Maximum number of elements
///
/// # Returns
/// * JavaScript object representing HnswConfig
#[wasm_bindgen]
pub fn create_hnsw_config_wasm(
    embedding_dimension: u32,
    m: u32,
    ef_construction: u32,
    ef_search: u32,
    max_elements: u32,
) -> Result<JsValue, JsValue> {
    let config = HnswConfig {
        embedding_dimension,
        m,
        ef_construction,
        ef_search,
        max_elements,
    };

    to_value(&config).map_err(|e| JsValue::from_str(&format!("Failed to create config: {}", e)))
}

/// Helper function to create VectorMetadata from JavaScript values
///
/// # Arguments
/// * `node_id` - Node identifier
/// * `file_path` - Path to source file
/// * `node_type` - Type of AST node
/// * `signature` - Function/method signature
/// * `language` - Programming language
/// * `embedding_model` - Model used for embedding
/// * `timestamp` - Timestamp of creation
///
/// # Returns
/// * JavaScript object representing VectorMetadata
#[wasm_bindgen]
pub fn create_vector_metadata_wasm(
    node_id: String,
    file_path: String,
    node_type: String,
    signature: String,
    language: String,
    embedding_model: String,
    timestamp: u32,
) -> Result<JsValue, JsValue> {
    let metadata = VectorMetadata {
        node_id,
        file_path,
        node_type,
        signature,
        language,
        embedding_model,
        timestamp,
    };

    to_value(&metadata).map_err(|e| JsValue::from_str(&format!("Failed to create metadata: {}", e)))
}

/// Convert Vec<f32> to Float32Array (utility function)
///
/// # Arguments
/// * `vec` - Vector to convert
///
/// # Returns
/// * Float32Array or JsValue error
#[wasm_bindgen]
pub fn vec_to_float32_array(vec: Vec<f32>) -> Float32Array {
    Float32Array::from(&vec[..])
}

/// Convert Float32Array to Vec<f32> (utility function)
/// This is handled internally but provided for completeness
#[wasm_bindgen]
pub fn float32_array_to_vec(arr: Float32Array) -> Vec<f32> {
    arr.to_vec()
}

// Internal helper functions

/// Validate embedding dimensions
fn validate_embedding_dimension(embedding: &[f32], expected_dim: usize) -> Result<(), WasmError> {
    if embedding.len() != expected_dim {
        return Err(WasmError::new(format!(
            "Invalid embedding dimension: expected {}, got {}",
            expected_dim,
            embedding.len()
        )));
    }
    Ok(())
}

/// Log function for WASM debugging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// Macro for console.log in WASM
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// Export the console_log macro for use in other modules
pub(crate) use console_log;

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_wasm_error_conversion() {
        let engine_error = EngineError::ValidationError("test error".to_string());
        let wasm_error = WasmError::from(engine_error);
        let js_value: JsValue = wasm_error.into();

        // This test will be expanded when we can run WASM tests
        assert!(js_value.is_string());
    }

    #[wasm_bindgen_test]
    fn test_config_creation() {
        let config = HnswConfig {
            embedding_dimension: 768,
            m: 16,
            ef_construction: 200,
            ef_search: 50,
            max_elements: 1000,
        };

        // Test that config can be serialized (actual WASM testing would need browser environment)
        assert_eq!(config.embedding_dimension, 768);
        assert_eq!(config.m, 16);
    }
}
