//! AST Core Engine - High-Performance Rust Backend
//!
//! This crate provides high-performance implementations for:
//! - Vector database operations with HNSW indexing
//! - AST processing with Tree-sitter integration
//! - Batch file processing with memory optimization
//! - Async storage layer with SQLite backend
//!
//! Designed to integrate with TypeScript via NAPI-RS bindings.

use napi::bindgen_prelude::*;
use napi_derive::napi;

pub mod config;
pub mod types;
pub mod error;
pub mod utils;
pub mod core;
pub mod storage;
pub mod vector_db;
pub mod ast_processor;
pub mod batch_processor;
pub mod performance_monitor;
pub mod api;

#[cfg(test)]
mod tests;

// Re-export main types and functions
pub use config::*;
pub use core::*;
pub use error::*;
pub use storage::*;
pub use types::*;
pub use utils::*;
pub use vector_db::{SimpleVectorDb};
pub use ast_processor::{
    AstProcessor, AstNode, AstProcessingResult, 
    SupportedLanguage, EngineStats
};

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
    let memory_info = utils::get_memory_usage();
    
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