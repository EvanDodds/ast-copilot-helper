//! Core engine configuration types and loading

use napi_derive::napi;
use serde::{Deserialize, Serialize};

/// Core engine configuration
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EngineConfig {
    /// Maximum memory usage in MB
    pub max_memory_mb: u32,
    /// Number of parallel workers
    pub parallel_workers: u32,
    /// Batch processing size
    pub batch_size: u32,
    /// Vector dimensions
    pub vector_dimensions: u32,
    /// HNSW index configuration
    pub hnsw_config: HnswConfig,
    /// Storage configuration
    pub storage_config: StorageConfig,
    /// Enable debug mode
    pub debug_mode: bool,
}

/// HNSW vector index configuration
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HnswConfig {
    /// Embedding dimension
    pub embedding_dimension: u32,
    /// M parameter (number of connections)
    pub m: u32,
    /// ef_construction parameter
    pub ef_construction: u32,
    /// ef_search parameter
    pub ef_search: u32,
    /// Maximum number of elements
    pub max_elements: u32,
}

/// Storage layer configuration
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StorageConfig {
    /// Database file path
    pub db_path: String,
    /// Maximum database connections
    pub max_connections: u32,
    /// Connection timeout in seconds
    pub connection_timeout_secs: u32,
    /// Enable WAL mode
    pub enable_wal: bool,
    /// Cache size in MB
    pub cache_size_mb: u32,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 1024,
            parallel_workers: 4,
            batch_size: 100,
            vector_dimensions: 768,
            hnsw_config: HnswConfig::default(),
            storage_config: StorageConfig::default(),
            debug_mode: false,
        }
    }
}

impl Default for HnswConfig {
    fn default() -> Self {
        Self {
            embedding_dimension: 384,
            m: 16,
            ef_construction: 200,
            ef_search: 100,
            max_elements: 1_000_000,
        }
    }
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            db_path: ".astdb/index.db".to_string(),
            max_connections: 10,
            connection_timeout_secs: 30,
            enable_wal: true,
            cache_size_mb: 256,
        }
    }
}

/// Load configuration from environment or use defaults
#[napi]
pub fn load_config() -> EngineConfig {
    EngineConfig {
        max_memory_mb: std::env::var("AST_MAX_MEMORY_MB")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1024),
        parallel_workers: std::env::var("AST_PARALLEL_WORKERS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(4),
        batch_size: std::env::var("AST_BATCH_SIZE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(100),
        vector_dimensions: std::env::var("AST_VECTOR_DIMENSIONS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(768),
        debug_mode: std::env::var("AST_DEBUG")
            .map(|v| v.to_lowercase() == "true" || v == "1")
            .unwrap_or(false),
        ..Default::default()
    }
}