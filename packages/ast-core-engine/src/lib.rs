//! AST Core Engine - WASM Vector Processing Engine
//!
//! This crate provides WASM-optimized implementations for:
//! - Vector database operations with semantic search
//! - High-performance vector similarity computations
//! - JavaScript/WASM interoperability for browser and Node.js environments
//!
//! Designed specifically for WebAssembly deployment with optimal performance
//! and minimal binary size.

// Core modules
pub mod config;
pub mod error;
pub mod types;
pub mod vector_db;
pub mod wasm_bindings;
pub mod wasm_serialization;

#[cfg(test)]
mod tests;

// Re-export main types and functions
pub use config::*;
pub use error::*;
pub use types::*;
pub use vector_db::SimpleVectorDb;

// Re-export WASM bindings
pub use wasm_bindings::*;

// Re-export WASM vector database functions
pub use wasm_bindings::{
    add_vector_to_db_wasm, clear_vector_database_wasm, create_hnsw_config_wasm,
    create_vector_metadata_wasm, get_vector_count_wasm, init_vector_database_wasm,
    search_vectors_wasm,
};
