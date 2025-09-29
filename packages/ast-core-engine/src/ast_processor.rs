use crate::error::{ASTProcessingError, EngineError};
use crate::types::ProcessingOptions;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
#[cfg(feature = "wasm")]
use tree_sitter::Parser;

// Language support - simplified for testing without external language parsers
/// Supported programming languages for AST processing
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SupportedLanguage {
    JavaScript,
    TypeScript,
    Python,
    Rust,
    Java,
    Cpp,
}

/// AST node information for analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstNode {
    pub node_type: String,
    pub start_byte: u32,
    pub end_byte: u32,
    pub start_row: u32,
    pub end_row: u32,
    pub start_column: u32,
    pub end_column: u32,
    pub text: String,
    pub children_count: u32,
    pub is_named: bool,
}

/// AST processing result containing parsed nodes and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstProcessingResult {
    pub nodes: Vec<AstNode>,
    pub language: String,
    pub file_path: String,
    pub processing_time_ms: u32,
    pub total_nodes: u32,
    pub error_count: u32,
}

/// Parser pool for efficient multi-threaded parsing
pub struct ParserPool {
    parsers: DashMap<SupportedLanguage, Vec<Parser>>,
    max_pool_size: usize,
}

impl ParserPool {
    pub fn new(max_pool_size: usize) -> Self {
        Self {
            parsers: DashMap::new(),
            max_pool_size,
        }
    }

    /// Get a parser for the specified language, creating if necessary
    pub fn get_parser(&self, language: SupportedLanguage) -> Result<Parser, EngineError> {
        let mut parser_entry = self.parsers.entry(language.clone()).or_default();

        if let Some(parser) = parser_entry.pop() {
            return Ok(parser);
        }

        // Create new parser if pool is empty
        let parser = Parser::new();

        // For now, we'll just return the parser without setting language
        // This allows compilation while we focus on the structure
        // TODO: Add language setting when Tree-sitter grammars are available

        Ok(parser)
    }

    /// Return parser to pool for reuse
    pub fn return_parser(&self, language: SupportedLanguage, parser: Parser) {
        let mut parser_entry = self.parsers.entry(language).or_default();
        if parser_entry.len() < self.max_pool_size {
            parser_entry.push(parser);
        }
        // If pool is full, parser will be dropped
    }
}

/// High-performance AST processing engine with Tree-sitter integration
pub struct AstProcessor {
    parser_pool: Arc<ParserPool>,
}

impl AstProcessor {
    /// Create new AST processor with parser pooling
    pub fn new(max_parsers_per_language: usize) -> Self {
        Self {
            parser_pool: Arc::new(ParserPool::new(max_parsers_per_language)),
        }
    }

    /// Parse source code and extract AST nodes (simplified version)
    pub fn parse_code(
        &self,
        source_code: &str,
        language: SupportedLanguage,
        file_path: &str,
        _options: &ProcessingOptions,
    ) -> Result<AstProcessingResult, EngineError> {
        let start_time = std::time::Instant::now();

        // For now, return a mock result to test the structure
        // TODO: Implement actual Tree-sitter parsing when grammars are available
        let nodes = vec![AstNode {
            node_type: "program".to_string(),
            start_byte: 0,
            end_byte: source_code.len() as u32,
            start_row: 0,
            end_row: source_code.lines().count() as u32,
            start_column: 0,
            end_column: 0,
            text: source_code.chars().take(100).collect::<String>() + "...",
            children_count: 1,
            is_named: true,
        }];

        let processing_time = start_time.elapsed().as_millis() as u32;

        Ok(AstProcessingResult {
            nodes,
            language: format!("{:?}", language),
            file_path: file_path.to_string(),
            processing_time_ms: processing_time,
            total_nodes: 1,
            error_count: 0,
        })
    }

    /// Process multiple files in parallel
    pub async fn process_files_batch(
        self: Arc<Self>,
        files: Vec<(String, String, SupportedLanguage)>, // (content, path, language)
        options: ProcessingOptions,
    ) -> Result<Vec<AstProcessingResult>, EngineError> {
        use tokio::task::spawn_blocking;

        let mut tasks = Vec::new();

        for (content, path, language) in files {
            let processor_clone = self.clone();
            let options_clone = options.clone();

            let task = spawn_blocking(move || {
                processor_clone.parse_code(&content, language, &path, &options_clone)
            });

            tasks.push(task);
        }

        let mut results = Vec::new();
        for task in tasks {
            let result = task.await.map_err(|e| {
                EngineError::ASTProcessing(ASTProcessingError::TreeSitter(format!(
                    "Task join error: {}",
                    e
                )))
            })?;
            results.push(result?);
        }

        Ok(results)
    }

    /// Get engine statistics
    pub fn get_stats(&self) -> EngineStats {
        let mut total_parsers = 0;
        let mut languages_available = 0;

        for entry in self.parser_pool.parsers.iter() {
            languages_available += 1;
            total_parsers += entry.value().len();
        }

        EngineStats {
            total_parsers,
            languages_available,
            max_pool_size: self.parser_pool.max_pool_size,
        }
    }
}

/// Engine statistics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStats {
    pub total_parsers: usize,
    pub languages_available: usize,
    pub max_pool_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ast_processor_creation() {
        let processor = AstProcessor::new(4);
        let stats = processor.get_stats();
        assert_eq!(stats.max_pool_size, 4);
    }

    #[test]
    fn test_parser_pool() {
        let pool = ParserPool::new(2);

        // Get parser for JavaScript
        let parser1 = pool.get_parser(SupportedLanguage::JavaScript);
        assert!(parser1.is_ok());

        // Return parser to pool
        pool.return_parser(SupportedLanguage::JavaScript, parser1.unwrap());

        // Get parser again (should reuse from pool)
        let parser2 = pool.get_parser(SupportedLanguage::JavaScript);
        assert!(parser2.is_ok());
    }

    #[test]
    fn test_simple_code_parsing() {
        let processor = AstProcessor::new(1);
        let source = "function hello() { return 'world'; }";
        let options = ProcessingOptions {
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            batch_size: 100,
            enable_caching: true,
            max_memory_mb: 1024,
            parallel_workers: 4,
            vector_dimensions: 768,
            index_ef_construction: 200,
            index_m: 16,
        };

        let result =
            processor.parse_code(source, SupportedLanguage::JavaScript, "test.js", &options);

        assert!(result.is_ok());
        let ast_result = result.unwrap();
        assert_eq!(ast_result.language, "JavaScript");
        assert_eq!(ast_result.file_path, "test.js");
        assert!(ast_result.nodes.len() > 0);
        assert_eq!(ast_result.error_count, 0);
    }

    #[tokio::test]
    async fn test_batch_processing() {
        let processor = Arc::new(AstProcessor::new(2));
        let files = vec![
            (
                "function a() {}".to_string(),
                "a.js".to_string(),
                SupportedLanguage::JavaScript,
            ),
            (
                "def b(): pass".to_string(),
                "b.py".to_string(),
                SupportedLanguage::Python,
            ),
        ];

        let options = ProcessingOptions {
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            batch_size: 100,
            enable_caching: true,
            max_memory_mb: 1024,
            parallel_workers: 4,
            vector_dimensions: 768,
            index_ef_construction: 200,
            index_m: 16,
        };

        let results = processor.process_files_batch(files, options).await;
        assert!(results.is_ok());

        let batch_results = results.unwrap();
        assert_eq!(batch_results.len(), 2);
        assert_eq!(batch_results[0].file_path, "a.js");
        assert_eq!(batch_results[1].file_path, "b.py");
    }

    #[test]
    fn test_supported_language_enum() {
        let languages = vec![
            SupportedLanguage::TypeScript,
            SupportedLanguage::JavaScript,
            SupportedLanguage::Python,
            SupportedLanguage::Rust,
            SupportedLanguage::Java,
            SupportedLanguage::Cpp,
        ];

        for lang in languages {
            let serialized = serde_json::to_string(&lang).unwrap();
            let deserialized: SupportedLanguage = serde_json::from_str(&serialized).unwrap();
            assert_eq!(lang, deserialized);
        }
    }

    #[test]
    fn test_engine_stats() {
        let processor = AstProcessor::new(3);
        let stats = processor.get_stats();

        assert_eq!(stats.max_pool_size, 3);
        assert_eq!(stats.total_parsers, 0); // No parsers created yet
        assert_eq!(stats.languages_available, 0); // No parsers requested yet
    }
}
