//! Annotation types and data structures

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete annotation data for an AST node
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Annotation {
    /// AST node type
    pub node_type: String,
    /// Programming language
    pub language: String,
    /// Function/class signature
    pub signature: String,
    /// Function parameters
    pub parameters: Vec<Parameter>,
    /// Return type information
    pub return_type: Option<String>,
    /// Access modifiers (public, private, etc.)
    pub modifiers: Vec<String>,
    /// Complexity analysis metrics
    pub complexity_metrics: Option<ComplexityMetrics>,
    /// Dependency analysis
    pub dependencies: Option<DependencyInfo>,
    /// Semantic classification tags
    pub semantic_tags: Vec<SemanticTag>,
    /// Human-readable summary
    pub summary: String,
    /// Start line in source (1-based)
    pub start_line: u32,
    /// End line in source (1-based)
    pub end_line: u32,
}

/// Function/method parameter information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Parameter {
    /// Parameter name
    pub name: String,
    /// Parameter type (if available)
    pub param_type: Option<String>,
    /// Whether parameter is optional
    pub optional: bool,
    /// Default value (if any)
    pub default_value: Option<String>,
}

/// Context lines surrounding a code snippet
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ContextLines {
    pub before: Vec<String>,
    pub after: Vec<String>,
}

/// Semantic tags for code classification
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum SemanticTag {
    // Functional categories
    Utility,
    Handler,
    Controller,
    Service,
    Model,
    View,
    Component,

    // Architectural patterns
    Factory,
    Builder,
    Observer,
    Singleton,

    // Code patterns
    Async,
    Generator,
    Generic,
    Recursive,

    // Testing
    Test,
    Mock,
    Fixture,

    // Infrastructure
    Config,
    Logger,
    Database,
    Api,

    // Business logic
    Validation,
    Transformation,
    Calculation,
    Business,
}

/// Detailed complexity metrics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ComplexityMetrics {
    /// Base cyclomatic complexity
    pub cyclomatic: u32,
    /// Cognitive complexity (accounts for nesting)
    pub cognitive: u32,
    /// Maximum nesting depth
    pub max_nesting: u32,
    /// Number of decision points
    pub decision_points: u32,
    /// Breakdown by decision type
    pub breakdown: HashMap<String, u32>,
    /// Complexity category
    pub category: ComplexityCategory,
}

/// Complexity classification levels
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum ComplexityCategory {
    Low,      // 1-10
    Medium,   // 11-20
    High,     // 21-50
    VeryHigh, // 50+
}

/// Dependency information for a code node
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DependencyInfo {
    /// Imported modules/symbols
    pub imports: Vec<String>,
    /// Exported symbols
    pub exports: Vec<String>,
    /// Function/method calls made
    pub calls: Vec<String>,
    /// External library dependencies
    pub external_dependencies: Vec<String>,
    /// Internal project dependencies
    pub internal_dependencies: Vec<String>,
}

/// Configuration for annotation generation
#[derive(Clone, Debug)]
pub struct AnnotationConfig {
    /// Enable complexity analysis
    pub include_complexity: bool,
    /// Enable dependency analysis
    pub include_dependencies: bool,
    /// Continue on errors
    pub continue_on_error: bool,
    /// Minimum lines to process
    pub min_lines: Option<u32>,
    /// Maximum lines to process
    pub max_lines: Option<u32>,
    /// Node types to include (empty = all)
    pub included_node_types: Vec<String>,
    /// Node types to exclude
    pub excluded_node_types: Vec<String>,
}

impl Default for AnnotationConfig {
    fn default() -> Self {
        Self {
            include_complexity: true,
            include_dependencies: true,
            continue_on_error: true,
            min_lines: None,
            max_lines: None,
            included_node_types: vec![],
            excluded_node_types: vec![],
        }
    }
}

/// Error types for annotation operations
#[derive(Clone, Debug)]
pub enum AnnotationError {
    UnsupportedLanguage(String),
    ParseError(String),
    IoError(String),
}

impl std::fmt::Display for AnnotationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnnotationError::UnsupportedLanguage(lang) => {
                write!(f, "Unsupported language: {}", lang)
            }
            AnnotationError::ParseError(err) => write!(f, "Parse error: {}", err),
            AnnotationError::IoError(err) => write!(f, "IO error: {}", err),
        }
    }
}

impl std::error::Error for AnnotationError {}

/// Result type for annotation operations
pub type AnnotationResult<T> = Result<T, AnnotationError>;
