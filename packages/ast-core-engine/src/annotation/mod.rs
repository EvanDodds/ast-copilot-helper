//! AST Annotation Engine
//!
//! Provides comprehensive annotation and metadata generation for AST nodes.
//! Integrates directly with the parsing pipeline for optimal performance.

pub mod complexity;
pub mod dependency;
pub mod engine;
pub mod extractors;
pub mod types;

// Re-export main types and traits
pub use complexity::{ComplexityAnalyzer, ComplexityClassifier};
pub use dependency::DependencyAnalyzer;
pub use engine::AnnotationEngine;
pub use extractors::{
    JavaExtractor, JavaScriptExtractor, LanguageExtractor, PythonExtractor, RustExtractor,
    TypeScriptExtractor,
};
pub use types::{
    Annotation, AnnotationConfig, AnnotationError, AnnotationResult, ComplexityMetrics,
    DependencyInfo, Parameter, SemanticTag,
};
