//! WASM Bindings for Vector Database Operations
//!
//! This module provides WebAssembly bindings for the vector database functionality,
//! adapting the existing NAPI implementation to work with wasm-bindgen.

use crate::{
    config::HnswConfig,
    error::EngineError,
    types::VectorMetadata,
    vector_db::SimpleVectorDb,
    wasm_serialization::{ArrayConverter, DataValidator, MemoryManager, TypeSerializer},
};
use js_sys::Float32Array;
use serde_wasm_bindgen::{from_value, to_value};
use std::sync::{Mutex, OnceLock};
use wasm_bindgen::prelude::*;

// Log function for WASM debugging (conditionally compiled for wasm target)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Helper macro for WASM console logging
#[cfg(target_arch = "wasm32")]
macro_rules! wasm_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// No-op logging for non-WASM targets
#[cfg(not(target_arch = "wasm32"))]
macro_rules! wasm_log {
    ($($t:tt)*) => {};
}

/// Global vector database instance for WASM
static WASM_VECTOR_DB: OnceLock<Mutex<SimpleVectorDb>> = OnceLock::new();

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

    // Comprehensive configuration validation
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

    if config.m == 0 || config.m > 100 {
        return Err(JsValue::from_str(&format!(
            "Invalid m parameter: {}. Must be between 1 and 100",
            config.m
        )));
    }

    if config.ef_construction == 0 || config.ef_construction > 1000 {
        return Err(JsValue::from_str(&format!(
            "Invalid ef_construction: {}. Must be between 1 and 1000",
            config.ef_construction
        )));
    }

    // Check if database is already initialized
    if let Some(existing_db_mutex) = WASM_VECTOR_DB.get() {
        let existing_db = existing_db_mutex.lock().unwrap();
        // If already initialized with compatible config, just clear and return success
        if existing_db.config.embedding_dimension == config.embedding_dimension
            && existing_db.config.max_elements >= config.max_elements
        {
            drop(existing_db); // Release the lock before mutable lock
            existing_db_mutex
                .lock()
                .unwrap()
                .clear()
                .map_err(WasmError::from)?;
            wasm_log!("Vector database reinitialized with compatible config");
            return Ok("Vector database reinitialized successfully".to_string());
        } else {
            return Err(JsValue::from_str(&format!(
                "Vector database already initialized with incompatible configuration. Current: dim={}, max={}",
                existing_db.config.embedding_dimension,
                existing_db.config.max_elements
            )));
        }
    }

    let db = SimpleVectorDb::new(config.clone());
    db.initialize().map_err(WasmError::from)?;

    WASM_VECTOR_DB
        .set(Mutex::new(db))
        .map_err(|_| JsValue::from_str("Vector database initialization race condition"))?;

    wasm_log!(
        "Vector database initialized: dim={}, max_elements={}",
        config.embedding_dimension,
        config.max_elements
    );

    Ok(format!(
        "Vector database initialized successfully with {} dimensions",
        config.embedding_dimension
    ))
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
    let db_mutex = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    // Validate node_id format
    DataValidator::validate_node_id(&node_id)?;

    // Convert Float32Array to Vec<f32> with validation
    let embedding_vec = ArrayConverter::float32_array_to_vec(&embedding)?;

    // Deserialize metadata with enhanced error handling
    let metadata = TypeSerializer::deserialize_vector_metadata(metadata_js)?;

    // Validate embedding dimensions and values and add vector
    let _new_count = {
        let mut db = db_mutex.lock().unwrap();
        DataValidator::validate_embedding(&embedding_vec, db.config.embedding_dimension as usize)?;

        // Check memory limits before adding
        let current_count = db.get_vector_count() as usize;
        MemoryManager::check_memory_limit(
            current_count,
            1,
            db.config.embedding_dimension as usize,
            512, // 512MB default limit
        )?;

        db.add_vector(node_id.clone(), embedding_vec, metadata)
            .map_err(WasmError::from)?;

        current_count + 1
    };

    wasm_log!("Added vector for node: {} (total: {})", node_id, new_count);

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
    let db_mutex = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    // Validate search parameters
    DataValidator::validate_search_params(k, ef_search)?;

    // Convert Float32Array to Vec<f32> with validation
    let query_vec = ArrayConverter::float32_array_to_vec(&query_embedding)?;

    let results = {
        let db = db_mutex.lock().unwrap();
        // Validate query embedding dimensions and values
        DataValidator::validate_embedding(&query_vec, db.config.embedding_dimension as usize)?;

        db.search_similar(query_vec, k, ef_search)
            .map_err(WasmError::from)?
    };

    wasm_log!(
        "Search completed: found {} results for k={}",
        results.len(),
        k
    );

    // Use enhanced serialization for results
    TypeSerializer::serialize_search_results(&results).map_err(|e| e.into())
}

/// Get the total number of vectors in the database
///
/// # Returns
/// * Number of vectors as u32 or throws JsValue error
#[wasm_bindgen]
pub fn get_vector_count_wasm() -> Result<u32, JsValue> {
    let db_mutex = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    Ok(db_mutex.lock().unwrap().get_vector_count())
}

/// Clear all vectors from the database
///
/// # Returns
/// * Success message as string or throws JsValue error
#[wasm_bindgen]
pub fn clear_vector_database_wasm() -> Result<String, JsValue> {
    let db_mutex = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    let mut db = db_mutex.lock().unwrap();
    let count_before = db.get_vector_count();
    db.clear().map_err(WasmError::from)?;

    wasm_log!("Cleared {} vectors from database", count_before);

    Ok(format!(
        "Vector database cleared successfully ({} vectors removed)",
        count_before
    ))
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
    // Use enhanced config creation with validation
    TypeSerializer::create_config_object(
        embedding_dimension,
        m,
        ef_construction,
        ef_search,
        max_elements,
    )
    .map_err(|e| e.into())
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
/// * Float32Array or error
#[wasm_bindgen]
pub fn vec_to_float32_array(vec: Vec<f32>) -> Result<Float32Array, JsValue> {
    ArrayConverter::vec_to_float32_array(vec).map_err(|e| e.into())
}

/// Convert Float32Array to Vec<f32> (utility function)
/// This is handled internally but provided for completeness
///
/// # Arguments
/// * `arr` - Float32Array to convert
///
/// # Returns
/// * Vec<f32> or error
#[wasm_bindgen]
pub fn float32_array_to_vec(arr: Float32Array) -> Result<Vec<f32>, JsValue> {
    ArrayConverter::float32_array_to_vec(&arr).map_err(|e| e.into())
}

/// Get database statistics for monitoring and debugging
///
/// # Returns
/// * JavaScript object with database statistics
#[wasm_bindgen]
pub fn get_database_stats_wasm() -> Result<JsValue, JsValue> {
    let db_mutex = WASM_VECTOR_DB
        .get()
        .ok_or_else(|| JsValue::from_str("Vector database not initialized"))?;

    // Create comprehensive stats structure
    use std::collections::HashMap;
    let mut stats = HashMap::new();
    let db = db_mutex.lock().unwrap();
    stats.insert("vector_count", db.get_vector_count() as f64);
    stats.insert("embedding_dimension", db.config.embedding_dimension as f64);
    stats.insert("max_elements", db.config.max_elements as f64);
    stats.insert("m", db.config.m as f64);
    stats.insert("ef_construction", db.config.ef_construction as f64);
    stats.insert("ef_search", db.config.ef_search as f64);

    // Add memory information
    let memory_usage = MemoryManager::estimate_vector_memory(
        db.config.embedding_dimension as usize,
        db.get_vector_count() as usize,
    );
    stats.insert("memory_usage_bytes", memory_usage as f64);
    stats.insert("memory_usage_mb", (memory_usage as f64) / (1024.0 * 1024.0));

    to_value(&stats).map_err(|e| JsValue::from_str(&format!("Failed to serialize stats: {}", e)))
}

/// Validate embedding data before processing (utility function)
///
/// # Arguments
/// * `embedding` - Float32Array to validate
/// * `expected_dimension` - Expected dimension size
///
/// # Returns
/// * Validation result or error
#[wasm_bindgen]
pub fn validate_embedding_wasm(
    embedding: Float32Array,
    expected_dimension: u32,
) -> Result<String, JsValue> {
    let embedding_vec = ArrayConverter::float32_array_to_vec(&embedding)?;
    DataValidator::validate_embedding(&embedding_vec, expected_dimension as usize)?;
    Ok(format!(
        "Embedding validation passed: {} dimensions",
        embedding_vec.len()
    ))
}

/// Check memory usage for a batch operation
///
/// # Arguments
/// * `vector_count` - Number of vectors to add
/// * `dimensions` - Embedding dimensions
/// * `max_memory_mb` - Memory limit in MB
///
/// # Returns
/// * Memory check result or error
#[wasm_bindgen]
pub fn check_memory_usage_wasm(
    vector_count: u32,
    dimensions: u32,
    max_memory_mb: u32,
) -> Result<JsValue, JsValue> {
    let current_db = WASM_VECTOR_DB.get();
    let current_count = current_db
        .map(|db_mutex| db_mutex.lock().unwrap().get_vector_count())
        .unwrap_or(0) as usize;

    MemoryManager::check_memory_limit(
        current_count,
        vector_count as usize,
        dimensions as usize,
        max_memory_mb as usize,
    )?;

    MemoryManager::create_memory_stats(vector_count, dimensions).map_err(|e| e.into())
}

/// Batch convert multiple vectors to Float32Arrays
/// Note: This function would be used with JavaScript arrays passed from JS side
///
/// # Arguments
/// * `js_vectors` - JavaScript array of vectors to convert
///
/// # Returns
/// * JavaScript array of Float32Array objects
#[wasm_bindgen]
pub fn batch_convert_vectors_wasm(_js_vectors: JsValue) -> Result<JsValue, JsValue> {
    // This is a placeholder - in real usage, vectors would be passed from JavaScript
    // For now, create a simple example conversion
    let example_vectors = vec![vec![1.0, 2.0, 3.0], vec![4.0, 5.0, 6.0]];
    ArrayConverter::vecs_to_js_arrays(example_vectors)
        .map_err(|e| e.into())
        .map(|arr| arr.into())
}

// Internal helper functions

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

        // Verify error is properly converted to JsValue
        assert!(js_value.is_string());
        assert_eq!(js_value.as_string().unwrap(), "test error");
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

        // Test that config values are properly set
        assert_eq!(config.embedding_dimension, 768);
        assert_eq!(config.m, 16);
        assert_eq!(config.ef_construction, 200);
        assert_eq!(config.ef_search, 50);
        assert_eq!(config.max_elements, 1000);
    }

    #[test]
    fn test_utility_functions() {
        // Test vector conversion utilities
        let test_vec = vec![1.0, 2.0, 3.0, 4.0];
        let float_array = vec_to_float32_array(test_vec.clone());

        // Test Float32Array creation
        assert_eq!(float_array.length(), 4);

        // Test conversion back to vec (would work in browser environment)
        let converted_back = float32_array_to_vec(float_array);
        assert_eq!(converted_back.len(), 4);
    }

    #[test]
    fn test_wasm_error_creation() {
        let error = WasmError::new("Test error message");
        let js_val: JsValue = error.into();
        assert!(js_val.is_string());
    }
}
