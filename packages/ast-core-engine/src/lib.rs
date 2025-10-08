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
#[cfg(any(feature = "wasm", feature = "full-system", test))] // Annotation engine
pub mod annotation;
#[cfg(any(feature = "wasm", feature = "full-system", test))] // AST processor needs tree-sitter
pub mod ast_processor;
#[cfg(feature = "full-system")] // Batch processor needs file system access
pub mod batch_processor;
pub mod config;
pub mod core;
pub mod error;
#[cfg(any(feature = "wasm", feature = "full-system", test))] // Language config for parsing
pub mod language_config;
#[cfg(any(feature = "wasm", feature = "full-system", test))] // High-level parse interface
pub mod parse_interface;
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

// Re-export annotation functionality (specific items to avoid conflicts)
#[cfg(any(feature = "wasm", feature = "full-system", test))]
pub use annotation::{
    AnnotationConfig, AnnotationEngine, AnnotationError, AnnotationResult, ComplexityAnalyzer,
    ComplexityMetrics, DependencyAnalyzer, DependencyInfo, LanguageExtractor,
};

// Re-export WASM bindings
pub use wasm_bindings::*;
