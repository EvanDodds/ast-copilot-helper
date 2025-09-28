//! AST Core Engine - High-Performance Rust Backend
//!
//! This crate provides high-performance implementations for:
//! - Vector database operations with HNSW indexing
//! - AST processing with Tree-sitter integration
//! - Batch file processing with memory optimization
//! - Async storage layer with SQLite backend
//!
//! Supports both NAPI-RS (Node.js) and WASM compilation targets.

// Conditional compilation imports are handled per-module

// WASM imports for WebAssembly bindings
// WASM bindings are imported in the wasm_bindings module

pub mod config;
pub mod error;
pub mod types;
pub mod vector_db;

// Include other modules only when not compiling for WASM
#[cfg(not(feature = "wasm"))]
pub mod api;
#[cfg(not(feature = "wasm"))]
pub mod ast_processor;
#[cfg(not(feature = "wasm"))]
pub mod batch_processor;
#[cfg(not(feature = "wasm"))]
pub mod core;
#[cfg(not(feature = "wasm"))]
pub mod performance_monitor;
#[cfg(not(feature = "wasm"))]
pub mod storage;
#[cfg(not(feature = "wasm"))]
pub mod utils;

// WASM-specific module
#[cfg(feature = "wasm")]
pub mod wasm_bindings;
#[cfg(feature = "wasm")]
pub mod wasm_serialization;

#[cfg(test)]
mod tests;

// Re-export main types and functions
pub use config::*;
pub use error::*;
pub use types::*;
pub use vector_db::SimpleVectorDb;

// Re-export additional modules only when not compiling for WASM
#[cfg(not(feature = "wasm"))]
pub use ast_processor::{
    AstNode, AstProcessingResult, AstProcessor, EngineStats, SupportedLanguage,
};
#[cfg(not(feature = "wasm"))]
pub use core::*;
#[cfg(not(feature = "wasm"))]
pub use storage::*;
#[cfg(not(feature = "wasm"))]
pub use utils::*;

// Re-export NAPI vector database functions
#[cfg(not(feature = "wasm"))]
pub use vector_db::{
    add_vector_to_db, clear_vector_database, get_vector_count, init_vector_database, search_vectors,
};

// NAPI bindings for Node.js
#[cfg(not(feature = "wasm"))]
mod napi_bindings {
    use super::*;
    use napi_derive::napi;

    /// Initialize the Rust core engine with tracing
    #[napi]
    pub fn init_engine() -> napi::Result<()> {
        // Initialize tracing subscriber for logging
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .try_init()
            .map_err(|e| {
                napi::Error::new(
                    napi::Status::GenericFailure,
                    format!("Failed to initialize logging: {}", e),
                )
            })?;

        tracing::info!("AST Core Engine initialized");
        Ok(())
    }

    /// Get engine version information
    #[napi]
    pub fn get_engine_version() -> String {
        format!("ast-core-engine v{}", env!("CARGO_PKG_VERSION"))
    }

    /// Perform basic engine health check
    #[napi]
    pub async fn health_check() -> napi::Result<EngineHealth> {
        let memory_info = crate::utils::get_memory_usage();

        Ok(EngineHealth {
            status: "healthy".to_string(),
            memory_usage_mb: (memory_info / (1024 * 1024)) as u32,
            version: get_engine_version(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u32,
        })
    }
}

// Re-export NAPI functions at crate root
#[cfg(not(feature = "wasm"))]
pub use napi_bindings::*;

// WASM bindings are now in separate wasm_bindings.rs module

// Re-export WASM functions at crate root
#[cfg(feature = "wasm")]
pub use wasm_bindings::*;

// Re-export WASM vector database functions
#[cfg(feature = "wasm")]
pub use wasm_bindings::{
    add_vector_to_db_wasm, clear_vector_database_wasm, create_hnsw_config_wasm,
    create_vector_metadata_wasm, get_vector_count_wasm, init_vector_database_wasm,
    search_vectors_wasm,
};
// Testing Rust validation
