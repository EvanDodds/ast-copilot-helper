//! WASM Data Serialization Layer
//!
//! This module provides comprehensive serialization utilities for converting between
//! Rust types and JavaScript/WASM types. It handles Vec<f32> ↔ Float32Array conversions,
//! JSON serialization for complex types, and error handling for serialization failures.

use crate::types::{BatchResult, EngineHealth, ProcessingOptions, SearchResult, VectorMetadata};
use js_sys::{Array, Float32Array, Object, Reflect};
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::{prelude::*, JsCast};

/// Enhanced error type for serialization operations
#[derive(Debug)]
pub struct SerializationError {
    pub message: String,
    pub error_type: SerializationErrorType,
}

#[derive(Debug)]
pub enum SerializationErrorType {
    TypeConversion,
    JsonParsing,
    ArrayConversion,
    InvalidInput,
    MemoryAllocation,
}

impl SerializationError {
    pub fn new(message: impl Into<String>, error_type: SerializationErrorType) -> Self {
        Self {
            message: message.into(),
            error_type,
        }
    }
}

impl From<SerializationError> for JsValue {
    fn from(error: SerializationError) -> Self {
        let error_obj = Object::new();
        let _ = Reflect::set(
            &error_obj,
            &JsValue::from_str("message"),
            &JsValue::from_str(&error.message),
        );
        let _ = Reflect::set(
            &error_obj,
            &JsValue::from_str("type"),
            &JsValue::from_str(match error.error_type {
                SerializationErrorType::TypeConversion => "TypeConversion",
                SerializationErrorType::JsonParsing => "JsonParsing",
                SerializationErrorType::ArrayConversion => "ArrayConversion",
                SerializationErrorType::InvalidInput => "InvalidInput",
                SerializationErrorType::MemoryAllocation => "MemoryAllocation",
            }),
        );
        error_obj.into()
    }
}

/// Optimized Float32Array conversion utilities
pub struct ArrayConverter;

impl ArrayConverter {
    /// Convert Vec<f32> to Float32Array with optimized memory allocation
    pub fn vec_to_float32_array(vec: Vec<f32>) -> Result<Float32Array, SerializationError> {
        if vec.is_empty() {
            return Ok(Float32Array::new(&JsValue::from_f64(0.0)));
        }

        // Pre-allocate array with known size for better performance
        let array = Float32Array::new(&JsValue::from_f64(vec.len() as f64));
        array.copy_from(&vec);
        Ok(array)
    }

    /// Convert Float32Array to Vec<f32> with validation
    pub fn float32_array_to_vec(array: &Float32Array) -> Result<Vec<f32>, SerializationError> {
        let length = array.length() as usize;
        if length == 0 {
            return Ok(Vec::new());
        }

        // Validate reasonable size limits to prevent memory exhaustion
        if length > 100_000 {
            return Err(SerializationError::new(
                format!("Array too large: {} elements (max 100,000)", length),
                SerializationErrorType::MemoryAllocation,
            ));
        }

        // Pre-allocate vector with exact capacity and initialize with zeros
        let mut vec = vec![0.0f32; length];
        array.copy_to(&mut vec);
        Ok(vec)
    }

    /// Convert array of vectors to JavaScript array of Float32Array
    pub fn vecs_to_js_arrays(vecs: Vec<Vec<f32>>) -> Result<Array, SerializationError> {
        let js_array = Array::new();
        for vec in vecs {
            let float_array = Self::vec_to_float32_array(vec)?;
            js_array.push(&float_array.into());
        }
        Ok(js_array)
    }

    /// Convert JavaScript array of Float32Array to Vec<Vec<f32>>
    pub fn js_arrays_to_vecs(js_array: &Array) -> Result<Vec<Vec<f32>>, SerializationError> {
        let length = js_array.length() as usize;
        let mut result = Vec::with_capacity(length);

        for i in 0..length {
            let js_value = js_array.get(i as u32);
            let float_array = js_value.dyn_into::<Float32Array>().map_err(|_| {
                SerializationError::new(
                    format!("Element at index {} is not a Float32Array", i),
                    SerializationErrorType::TypeConversion,
                )
            })?;
            let vec = Self::float32_array_to_vec(&float_array)?;
            result.push(vec);
        }
        Ok(result)
    }
}

/// Complex type serialization utilities
pub struct TypeSerializer;

impl TypeSerializer {
    /// Serialize SearchResult with optimized field handling
    pub fn serialize_search_result(result: &SearchResult) -> Result<JsValue, SerializationError> {
        to_value(result).map_err(|e| {
            SerializationError::new(
                format!("Failed to serialize SearchResult: {}", e),
                SerializationErrorType::JsonParsing,
            )
        })
    }

    /// Serialize array of SearchResults
    pub fn serialize_search_results(
        results: &[SearchResult],
    ) -> Result<JsValue, SerializationError> {
        to_value(results).map_err(|e| {
            SerializationError::new(
                format!("Failed to serialize SearchResult array: {}", e),
                SerializationErrorType::JsonParsing,
            )
        })
    }

    /// Deserialize VectorMetadata with validation
    pub fn deserialize_vector_metadata(
        js_value: JsValue,
    ) -> Result<VectorMetadata, SerializationError> {
        from_value(js_value).map_err(|e| {
            SerializationError::new(
                format!("Failed to deserialize VectorMetadata: {}", e),
                SerializationErrorType::JsonParsing,
            )
        })
    }

    /// Serialize BatchResult with performance metrics
    pub fn serialize_batch_result(result: &BatchResult) -> Result<JsValue, SerializationError> {
        to_value(result).map_err(|e| {
            SerializationError::new(
                format!("Failed to serialize BatchResult: {}", e),
                SerializationErrorType::JsonParsing,
            )
        })
    }

    /// Serialize EngineHealth status
    pub fn serialize_engine_health(health: &EngineHealth) -> Result<JsValue, SerializationError> {
        to_value(health).map_err(|e| {
            SerializationError::new(
                format!("Failed to serialize EngineHealth: {}", e),
                SerializationErrorType::JsonParsing,
            )
        })
    }

    /// Deserialize ProcessingOptions with defaults
    pub fn deserialize_processing_options(
        js_value: JsValue,
    ) -> Result<ProcessingOptions, SerializationError> {
        from_value(js_value).map_err(|e| {
            SerializationError::new(
                format!("Failed to deserialize ProcessingOptions: {}", e),
                SerializationErrorType::JsonParsing,
            )
        })
    }

    /// Create typed JavaScript object for configuration
    pub fn create_config_object(
        embedding_dimension: u32,
        m: u32,
        ef_construction: u32,
        ef_search: u32,
        max_elements: u32,
    ) -> Result<JsValue, SerializationError> {
        let config_obj = Object::new();

        let set_property = |key: &str, value: u32| -> Result<(), SerializationError> {
            Reflect::set(
                &config_obj,
                &JsValue::from_str(key),
                &JsValue::from_f64(value as f64),
            )
            .map_err(|_| {
                SerializationError::new(
                    format!("Failed to set property {}", key),
                    SerializationErrorType::TypeConversion,
                )
            })?;
            Ok(())
        };

        set_property("embedding_dimension", embedding_dimension)?;
        set_property("m", m)?;
        set_property("ef_construction", ef_construction)?;
        set_property("ef_search", ef_search)?;
        set_property("max_elements", max_elements)?;

        Ok(config_obj.into())
    }
}

/// Validation utilities for serialized data
pub struct DataValidator;

impl DataValidator {
    /// Validate embedding vector dimensions and values
    pub fn validate_embedding(
        embedding: &[f32],
        expected_dimension: usize,
    ) -> Result<(), SerializationError> {
        if embedding.is_empty() {
            return Err(SerializationError::new(
                "Embedding vector cannot be empty",
                SerializationErrorType::InvalidInput,
            ));
        }

        if embedding.len() != expected_dimension {
            return Err(SerializationError::new(
                format!(
                    "Invalid embedding dimension: expected {}, got {}",
                    expected_dimension,
                    embedding.len()
                ),
                SerializationErrorType::InvalidInput,
            ));
        }

        // Check for invalid values (NaN, infinity)
        for (i, &value) in embedding.iter().enumerate() {
            if !value.is_finite() {
                return Err(SerializationError::new(
                    format!("Invalid value at index {}: {}", i, value),
                    SerializationErrorType::InvalidInput,
                ));
            }
        }

        Ok(())
    }

    /// Validate search parameters
    pub fn validate_search_params(
        k: u32,
        ef_search: Option<u32>,
    ) -> Result<(), SerializationError> {
        if k == 0 {
            return Err(SerializationError::new(
                "k must be greater than 0",
                SerializationErrorType::InvalidInput,
            ));
        }

        if k > 10000 {
            return Err(SerializationError::new(
                "k too large (max 10000)",
                SerializationErrorType::InvalidInput,
            ));
        }

        if let Some(ef) = ef_search {
            if ef == 0 {
                return Err(SerializationError::new(
                    "ef_search must be greater than 0",
                    SerializationErrorType::InvalidInput,
                ));
            }
            if ef > 10000 {
                return Err(SerializationError::new(
                    "ef_search too large (max 10000)",
                    SerializationErrorType::InvalidInput,
                ));
            }
        }

        Ok(())
    }

    /// Validate node_id format
    pub fn validate_node_id(node_id: &str) -> Result<(), SerializationError> {
        if node_id.is_empty() {
            return Err(SerializationError::new(
                "node_id cannot be empty",
                SerializationErrorType::InvalidInput,
            ));
        }

        if node_id.len() > 1000 {
            return Err(SerializationError::new(
                "node_id too long (max 1000 characters)",
                SerializationErrorType::InvalidInput,
            ));
        }

        // Basic format validation - ensure printable ASCII
        if !node_id.chars().all(|c| c.is_ascii() && !c.is_control()) {
            return Err(SerializationError::new(
                "node_id contains invalid characters",
                SerializationErrorType::InvalidInput,
            ));
        }

        Ok(())
    }
}

/// Memory management utilities for WASM
pub struct MemoryManager;

impl MemoryManager {
    /// Estimate memory usage for vector data
    pub fn estimate_vector_memory(dimensions: usize, count: usize) -> usize {
        // Each f32 is 4 bytes, plus some overhead for Vec allocation
        (dimensions * count * 4) + (count * 64) // 64 bytes overhead per vector
    }

    /// Check if operation would exceed memory limits
    pub fn check_memory_limit(
        current_vectors: usize,
        new_vectors: usize,
        dimensions: usize,
        max_memory_mb: usize,
    ) -> Result<(), SerializationError> {
        let total_vectors = current_vectors + new_vectors;
        let estimated_mb = Self::estimate_vector_memory(dimensions, total_vectors) / (1024 * 1024);

        if estimated_mb > max_memory_mb {
            return Err(SerializationError::new(
                format!(
                    "Operation would exceed memory limit: {} MB > {} MB",
                    estimated_mb, max_memory_mb
                ),
                SerializationErrorType::MemoryAllocation,
            ));
        }

        Ok(())
    }

    /// Create memory statistics object
    pub fn create_memory_stats(
        vector_count: u32,
        dimensions: u32,
    ) -> Result<JsValue, SerializationError> {
        let memory_usage = Self::estimate_vector_memory(dimensions as usize, vector_count as usize);
        let stats_obj = Object::new();

        let set_stat = |key: &str, value: f64| -> Result<(), SerializationError> {
            Reflect::set(
                &stats_obj,
                &JsValue::from_str(key),
                &JsValue::from_f64(value),
            )
            .map_err(|_| {
                SerializationError::new(
                    format!("Failed to set memory stat {}", key),
                    SerializationErrorType::TypeConversion,
                )
            })?;
            Ok(())
        };

        set_stat("vector_count", vector_count as f64)?;
        set_stat("dimensions", dimensions as f64)?;
        set_stat("estimated_memory_bytes", memory_usage as f64)?;
        set_stat(
            "estimated_memory_mb",
            (memory_usage as f64) / (1024.0 * 1024.0),
        )?;

        Ok(stats_obj.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_family = "wasm")]
    #[test]
    fn test_array_converter() {
        let test_vec = vec![1.0, 2.0, 3.0, 4.0];
        let float_array = ArrayConverter::vec_to_float32_array(test_vec.clone()).unwrap();
        assert_eq!(float_array.length(), 4);

        // Test empty vector
        let empty_vec = Vec::new();
        let empty_array = ArrayConverter::vec_to_float32_array(empty_vec).unwrap();
        assert_eq!(empty_array.length(), 0);
    }

    #[test]
    fn test_data_validator() {
        // Valid embedding
        let valid_embedding = vec![0.1, 0.2, 0.3];
        assert!(DataValidator::validate_embedding(&valid_embedding, 3).is_ok());

        // Wrong dimension
        assert!(DataValidator::validate_embedding(&valid_embedding, 4).is_err());

        // Empty embedding
        let empty_embedding = Vec::new();
        assert!(DataValidator::validate_embedding(&empty_embedding, 3).is_err());

        // Invalid values
        let invalid_embedding = vec![0.1, f32::NAN, 0.3];
        assert!(DataValidator::validate_embedding(&invalid_embedding, 3).is_err());
    }

    #[test]
    fn test_search_params_validation() {
        // Valid parameters
        assert!(DataValidator::validate_search_params(10, Some(50)).is_ok());
        assert!(DataValidator::validate_search_params(10, None).is_ok());

        // Invalid k
        assert!(DataValidator::validate_search_params(0, None).is_err());
        assert!(DataValidator::validate_search_params(20000, None).is_err());

        // Invalid ef_search
        assert!(DataValidator::validate_search_params(10, Some(0)).is_err());
        assert!(DataValidator::validate_search_params(10, Some(20000)).is_err());
    }

    #[test]
    fn test_node_id_validation() {
        // Valid node_id
        assert!(DataValidator::validate_node_id("test_node_123").is_ok());

        // Empty node_id
        assert!(DataValidator::validate_node_id("").is_err());

        // Too long node_id
        let long_id = "a".repeat(1001);
        assert!(DataValidator::validate_node_id(&long_id).is_err());
    }

    #[test]
    fn test_memory_estimation() {
        let memory = MemoryManager::estimate_vector_memory(768, 1000);
        assert!(memory > 0);

        // Should be roughly 768 * 1000 * 4 bytes plus overhead
        assert!(memory >= 3_072_000); // At least the vector data size
    }
}
