use crate::error::{ASTProcessingError, EngineError};
use crate::language_config::LanguageConfig;
use crate::types::ProcessingOptions;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
#[cfg(feature = "full-system")]
use tree_sitter::Parser;

// WASM-compatible parser stub
#[cfg(not(feature = "full-system"))]
pub struct Parser;

#[cfg(not(feature = "full-system"))]
impl Parser {
    pub fn new() -> Self {
        Parser
    }
}

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
    C,
    CSharp,
    Go,
    Ruby,
    Php,
    Kotlin,
    Swift,
    Scala,
    Bash,
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
    #[cfg(feature = "full-system")]
    pub fn get_parser(&self, language: SupportedLanguage) -> Result<Parser, EngineError> {
        let mut parser_entry = self.parsers.entry(language.clone()).or_default();

        if let Some(parser) = parser_entry.pop() {
            return Ok(parser);
        }

        // Create new parser with proper language configuration
        let mut parser = Parser::new();
        LanguageConfig::configure_parser(&mut parser, &language)?;

        Ok(parser)
    }

    /// Get a parser for WASM builds (fallback implementation)
    #[cfg(not(feature = "full-system"))]
    pub fn get_parser(&self, language: SupportedLanguage) -> Result<Parser, EngineError> {
        let mut parser_entry = self.parsers.entry(language.clone()).or_default();

        if let Some(parser) = parser_entry.pop() {
            return Ok(parser);
        }

        // Create new parser (WASM stub)
        let parser = Parser::new();
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

    /// Parse source code and extract AST nodes using Tree-sitter
    #[cfg(feature = "full-system")]
    pub fn parse_code(
        &self,
        source_code: &str,
        language: SupportedLanguage,
        file_path: &str,
        _options: &ProcessingOptions,
    ) -> Result<AstProcessingResult, EngineError> {
        let start_time = std::time::Instant::now();

        // Get parser from pool
        let mut parser = self.parser_pool.get_parser(language.clone())?;

        // Parse the source code
        let tree = parser.parse(source_code, None).ok_or_else(|| {
            EngineError::ASTProcessing(ASTProcessingError::TreeSitter(
                "Failed to parse source code".to_string(),
            ))
        })?;

        // Extract AST nodes from Tree-sitter tree
        let nodes = self.extract_ast_nodes(&tree, source_code);
        let total_nodes = nodes.len() as u32;
        let error_count = self.count_syntax_errors(&tree);

        // Return parser to pool
        self.parser_pool.return_parser(language.clone(), parser);

        let processing_time = start_time.elapsed().as_millis() as u32;

        Ok(AstProcessingResult {
            nodes,
            language: format!("{:?}", language),
            file_path: file_path.to_string(),
            processing_time_ms: processing_time,
            total_nodes,
            error_count,
        })
    }

    /// Parse source code - WASM fallback version
    #[cfg(not(feature = "full-system"))]
    pub fn parse_code(
        &self,
        source_code: &str,
        language: SupportedLanguage,
        file_path: &str,
        _options: &ProcessingOptions,
    ) -> Result<AstProcessingResult, EngineError> {
        let start_time = std::time::Instant::now();

        // WASM fallback - basic parsing structure
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

    /// Extract AST nodes from Tree-sitter tree
    #[cfg(feature = "full-system")]
    fn extract_ast_nodes(&self, tree: &tree_sitter::Tree, source_code: &str) -> Vec<AstNode> {
        let mut nodes = Vec::new();
        let mut cursor = tree.walk();

        // Walk the tree and extract significant nodes
        self.walk_tree_nodes(&mut cursor, source_code, &mut nodes);

        nodes
    }

    /// Recursively walk Tree-sitter nodes and extract significant ones
    #[cfg(feature = "full-system")]
    fn walk_tree_nodes(
        &self,
        cursor: &mut tree_sitter::TreeCursor,
        source_code: &str,
        nodes: &mut Vec<AstNode>,
    ) {
        let node = cursor.node();

        // Only process named nodes (skip anonymous tokens)
        if node.is_named() && self.is_significant_node_type(node.kind()) {
            let text = node.utf8_text(source_code.as_bytes()).unwrap_or("");

            nodes.push(AstNode {
                node_type: node.kind().to_string(),
                start_byte: node.start_byte() as u32,
                end_byte: node.end_byte() as u32,
                start_row: node.start_position().row as u32,
                end_row: node.end_position().row as u32,
                start_column: node.start_position().column as u32,
                end_column: node.end_position().column as u32,
                text: if text.len() > 200 {
                    format!("{}...", &text[..200])
                } else {
                    text.to_string()
                },
                children_count: node.child_count() as u32,
                is_named: node.is_named(),
            });
        }

        // Visit children
        if cursor.goto_first_child() {
            loop {
                self.walk_tree_nodes(cursor, source_code, nodes);
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
            cursor.goto_parent();
        }
    }

    /// Check if a node type is significant for AST analysis
    fn is_significant_node_type(&self, node_type: &str) -> bool {
        matches!(
            node_type,
            "program"
                | "source_file"
                | "module"
                | "function_declaration"
                | "function_definition"
                | "function"
                | "method_declaration"
                | "method_definition"
                | "method"
                | "class_declaration"
                | "class_definition"
                | "class"
                | "interface_declaration"
                | "interface"
                | "variable_declaration"
                | "variable_declarator"
                | "assignment_expression"
                | "import_declaration"
                | "import_statement"
                | "export_declaration"
                | "if_statement"
                | "for_statement"
                | "while_statement"
                | "try_statement"
                | "block"
                | "statement_block"
                | "compound_statement"
                | "call_expression"
                | "identifier"
                | "property_identifier"
        ) || node_type.contains("_statement")
            || node_type.contains("_expression")
    }

    /// Count syntax errors in the parsed tree
    #[cfg(feature = "full-system")]
    fn count_syntax_errors(&self, tree: &tree_sitter::Tree) -> u32 {
        let mut error_count = 0;
        let mut cursor = tree.walk();

        Self::count_errors_recursive(&mut cursor, &mut error_count);
        error_count
    }

    /// Recursively count syntax errors in tree
    #[cfg(feature = "full-system")]
    fn count_errors_recursive(cursor: &mut tree_sitter::TreeCursor, error_count: &mut u32) {
        let node = cursor.node();

        if node.has_error() || node.is_error() {
            *error_count += 1;
        }

        if cursor.goto_first_child() {
            loop {
                Self::count_errors_recursive(cursor, error_count);
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
            cursor.goto_parent();
        }
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
        assert!(!ast_result.nodes.is_empty());
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
            SupportedLanguage::C,
            SupportedLanguage::CSharp,
            SupportedLanguage::Go,
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
