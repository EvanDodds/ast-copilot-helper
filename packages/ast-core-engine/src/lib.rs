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
#[cfg(all(not(feature = "wasm"), feature = "napi"))] // API layer only for NAPI builds
pub mod api;
#[cfg(any(feature = "wasm", feature = "full-system", test))] // AST processor needs tree-sitter
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

// Re-export API for NAPI builds
#[cfg(all(not(feature = "wasm"), feature = "napi"))]
pub use api::*;
