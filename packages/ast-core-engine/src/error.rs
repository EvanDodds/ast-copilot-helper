//! Error handling types

use thiserror::Error;

/// Core engine error types
#[derive(Error, Debug)]
pub enum EngineError {
    #[error("Vector database error: {0}")]
    VectorDatabase(#[from] VectorDatabaseError),

    #[error("AST processing error: {0}")]
    ASTProcessing(#[from] ASTProcessingError),

    #[error("Storage error: {0}")]
    Storage(#[from] StorageError),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Memory error: {0}")]
    Memory(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Vector database error: {0}")]
    VectorDbError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Initialization error: {0}")]
    InitializationError(String),
}

/// Vector database specific errors
#[derive(Error, Debug)]
pub enum VectorDatabaseError {
    #[error("Index initialization failed: {0}")]
    IndexInit(String),

    #[error("Search operation failed: {0}")]
    Search(String),

    #[error("Insert operation failed: {0}")]
    Insert(String),

    #[error("Invalid vector dimensions: expected {expected}, got {actual}")]
    InvalidDimensions { expected: usize, actual: usize },
}

/// AST processing specific errors
#[derive(Error, Debug)]
pub enum ASTProcessingError {
    #[error("Parser initialization failed: {0}")]
    ParserInit(String),

    #[error("Parsing failed for file {file}: {error}")]
    Parsing { file: String, error: String },

    #[error("Unsupported language: {0}")]
    UnsupportedLanguage(String),

    #[error("Tree-sitter error: {0}")]
    TreeSitter(String),
}

/// Storage specific errors
#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Database connection failed: {0}")]
    Connection(String),

    #[error("Query execution failed: {0}")]
    Query(String),

    #[error("Transaction failed: {0}")]
    Transaction(String),

    #[error("Migration failed: {0}")]
    Migration(String),
}
