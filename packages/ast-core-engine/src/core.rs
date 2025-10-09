//! Core engine implementation
//!
//! This module contains the main engine configuration and initialization.
//! Actual component implementations are in separate modules:
//! - Vector database: `crate::vector_db::SimpleVectorDb`
//! - AST processor: `crate::ast_processor::AstProcessor`
//! - Batch processor: `crate::batch_processor::BatchProcessor`

use crate::{config::EngineConfig, error::EngineError};

/// Main AST Core Engine structure
pub struct ASTCoreEngine {
    config: EngineConfig,
}

impl ASTCoreEngine {
    /// Create new engine instance with configuration
    pub fn new(config: EngineConfig) -> Result<Self, EngineError> {
        Ok(Self { config })
    }

    /// Get engine configuration
    pub fn config(&self) -> &EngineConfig {
        &self.config
    }
}
