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
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

pub mod api;
pub mod ast_processor;
pub mod batch_processor;
pub mod config;
pub mod core;
pub mod error;
pub mod performance_monitor;
pub mod storage;
pub mod types;
pub mod utils;
pub mod vector_db;

#[cfg(test)]
mod tests;

// Re-export main types and functions
pub use ast_processor::{
    AstNode, AstProcessingResult, AstProcessor, EngineStats, SupportedLanguage,
};
pub use config::*;
pub use core::*;
pub use error::*;
pub use storage::*;
pub use types::*;
pub use utils::*;
pub use vector_db::SimpleVectorDb;

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

// WASM bindings for WebAssembly
#[cfg(feature = "wasm")]
mod wasm_bindings {
    use serde_wasm_bindgen::to_value;
    use wasm_bindgen::prelude::*;

    /// Initialize the Rust core engine (WASM version)
    #[wasm_bindgen]
    pub fn init_engine() -> Result<(), JsValue> {
        // Simple WASM initialization - no complex logging for Phase 1
        Ok(())
    }

    /// Get engine version information (WASM version)
    #[wasm_bindgen]
    pub fn get_engine_version() -> String {
        format!("ast-core-engine v{} (WASM)", env!("CARGO_PKG_VERSION"))
    }

    /// Perform basic engine health check (WASM version)
    #[wasm_bindgen]
    pub fn health_check() -> Result<JsValue, JsValue> {
        use js_sys::Date;

        // Create a simple health object without complex dependencies
        let health = serde_json::json!({
            "status": "healthy",
            "memory_usage_mb": 0,  // Placeholder for Phase 1
            "version": get_engine_version(),
            "timestamp": Date::now() as u32
        });

        to_value(&health).map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Simple test function for WASM compilation verification
    #[wasm_bindgen]
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }
}

// Re-export WASM functions at crate root
#[cfg(feature = "wasm")]
pub use wasm_bindings::*;
// Testing Rust validation
