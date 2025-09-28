//! Core types and data structures

// Conditional imports based on compilation target
#[cfg(not(feature = "wasm"))]
use napi_derive::napi;
// WASM types will be handled in wasm_bindings module

use serde::{Deserialize, Serialize};

/// Engine health status information
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EngineHealth {
    pub status: String,
    pub memory_usage_mb: u32,
    pub version: String,
    pub timestamp: u32,
}

/// Processing options for batch operations
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProcessingOptions {
    pub max_memory_mb: u32,
    pub batch_size: u32,
    pub parallel_workers: u32,
    pub vector_dimensions: u32,
    pub index_ef_construction: u32,
    pub index_m: u32,
    pub max_depth: u32,
    pub include_unnamed_nodes: bool,
    pub max_node_length: u32,
    pub enable_caching: bool,
}

/// Result of batch processing operation
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BatchResult {
    pub processed_files: u32,
    pub total_nodes: u32,
    pub processing_time_ms: u32,
    pub memory_peak_mb: u32,
    pub errors: Vec<ProcessingError>,
    pub performance_metrics: PerformanceMetrics,
}

/// Search result from vector database
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub node_id: String,
    pub file_path: String,
    pub node_type: String,
    pub similarity: f64,
    pub distance: f64,
}

/// Processing error information
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProcessingError {
    pub file_path: String,
    pub error_type: String,
    pub message: String,
}

/// Performance metrics for operations
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub parse_time_ms: u32,
    pub embedding_time_ms: u32,
    pub vector_search_time_ms: u32,
    pub memory_usage_mb: u32,
    pub throughput_files_per_sec: f64,
    pub error_rate: f64,
}

/// AST node representation
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ASTNode {
    pub id: String,
    pub node_type: String,
    pub start_byte: u32,
    pub end_byte: u32,
    pub start_point: Point,
    pub end_point: Point,
    pub text: String,
    pub language: String,
    pub complexity: i32,
    pub parent_id: Option<String>,
    pub children_ids: Vec<String>,
}

/// Source code position
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Point {
    pub row: u32,
    pub column: u32,
}

/// Node metadata for storage
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NodeMetadata {
    pub node_id: String,
    pub file_path: String,
    pub signature: String,
    pub summary: String,
    pub source_snippet: String,
    pub complexity: i32,
    pub language: String,
}

/// Annotation for AST nodes
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Annotation {
    pub signature: String,
    pub summary: String,
    pub source_snippet: String,
    pub complexity: i32,
    pub language: String,
}

/// Metadata associated with each vector in the database
#[cfg_attr(not(feature = "wasm"), napi(object))]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VectorMetadata {
    pub node_id: String,
    pub file_path: String,
    pub node_type: String,
    pub signature: String,
    pub language: String,
    pub embedding_model: String,
    pub timestamp: u32,
}

impl Default for ProcessingOptions {
    fn default() -> Self {
        Self {
            max_memory_mb: 1024,
            batch_size: 100,
            parallel_workers: 4,
            vector_dimensions: 768,
            index_ef_construction: 200,
            index_m: 16,
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            enable_caching: true,
        }
    }
}
