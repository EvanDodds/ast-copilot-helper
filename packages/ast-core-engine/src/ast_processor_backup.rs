use crate::error::{EngineError, ASTProcessingError};
use crate::types::{ProcessingOptions, SearchResult};
use dashmap::DashMap;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use tree_sitter::{Language, Parser, Tree, Node, Query, QueryCursor, QueryMatch};

// Language support
extern "C" {
    fn tree_sitter_typescript() -> Language;
    fn tree_sitter_javascript() -> Language;
    fn tree_sitter_python() -> Language;
    fn tree_sitter_rust() -> Language;
    fn tree_sitter_java() -> Language;
    fn tree_sitter_cpp() -> Language;
}

/// Supported programming languages for AST processing
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[napi(string_enum)]
pub enum SupportedLanguage {
    TypeScript,
    JavaScript,
    Python,
    Rust,
    Java,
    Cpp,
}

/// AST node information for analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
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
#[napi(object)]
pub struct AstProcessingResult {
    pub nodes: Vec<AstNode>,
    pub language: String,
    pub file_path: String,
    pub processing_time_ms: u32,
    pub total_nodes: u32,
    pub error_count: u32,
}

/// Query match result for pattern searching
#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct QueryMatchResult {
    pub pattern_index: u32,
    pub captures: Vec<AstNode>,
    pub match_text: String,
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
        let mut parser_entry = self.parsers.entry(language.clone()).or_insert_with(Vec::new);
        
        if let Some(parser) = parser_entry.pop() {
            return Ok(parser);
        }
        
        // Create new parser if pool is empty
        let mut parser = Parser::new();
        let tree_sitter_lang = match language {
            SupportedLanguage::TypeScript => unsafe { tree_sitter_typescript() },
            SupportedLanguage::JavaScript => unsafe { tree_sitter_javascript() },
            SupportedLanguage::Python => unsafe { tree_sitter_python() },
            SupportedLanguage::Rust => unsafe { tree_sitter_rust() },
            SupportedLanguage::Java => unsafe { tree_sitter_java() },
            SupportedLanguage::Cpp => unsafe { tree_sitter_cpp() },
        };
        
        parser.set_language(&tree_sitter_lang)
            .map_err(|e| EngineError::ASTProcessing(ASTProcessingError::ParserInit(format!("Failed to set language: {}", e))))?;
        
        Ok(parser)
    }

    /// Return parser to pool for reuse
    pub fn return_parser(&self, language: SupportedLanguage, parser: Parser) {
        let mut parser_entry = self.parsers.entry(language).or_insert_with(Vec::new);
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

    /// Parse source code and extract AST nodes
    pub fn parse_code(
        &self,
        source_code: &str,
        language: SupportedLanguage,
        file_path: &str,
        options: &ProcessingOptions,
    ) -> Result<AstProcessingResult, EngineError> {
        let start_time = std::time::Instant::now();
        
        let mut parser = self.parser_pool.get_parser(language.clone())?;
        
        let tree = parser.parse(source_code, None)
            .ok_or_else(|| EngineError::ASTProcessing(ASTProcessingError::Parsing { 
                file: file_path.to_string(),
                error: "Failed to parse source code".to_string()
            }))?;

        let root_node = tree.root_node();
        let mut nodes = Vec::new();
        let mut error_count = 0;

        // Extract nodes based on processing options
        self.extract_nodes_recursive(
            root_node, 
            source_code, 
            &mut nodes, 
            &mut error_count,
            options
        );

        // Return parser to pool
        self.parser_pool.return_parser(language.clone(), parser);

        let processing_time = start_time.elapsed().as_millis() as u32;

        Ok(AstProcessingResult {
            nodes,
            language: format!("{:?}", language),
            file_path: file_path.to_string(),
            processing_time_ms: processing_time,
            total_nodes: nodes.len() as u32,
            error_count,
        })
    }

    /// Extract nodes recursively from the AST
    fn extract_nodes_recursive(
        &self,
        node: Node,
        source_code: &str,
        nodes: &mut Vec<AstNode>,
        error_count: &mut u32,
        options: &ProcessingOptions,
    ) {
        // Check if node has errors
        if node.has_error() {
            *error_count += 1;
        }

        // Apply filtering based on options
        let should_include = match options.include_unnamed_nodes {
            true => true,
            false => node.is_named(),
        };

        if should_include {
            let node_text = node.utf8_text(source_code.as_bytes())
                .unwrap_or("[invalid utf8]")
                .to_string();

            // Apply max node length filter
            if node_text.len() <= options.max_node_length as usize {
                let ast_node = AstNode {
                    node_type: node.kind().to_string(),
                    start_byte: node.start_byte() as u32,
                    end_byte: node.end_byte() as u32,
                    start_row: node.start_position().row as u32,
                    end_row: node.end_position().row as u32,
                    start_column: node.start_position().column as u32,
                    end_column: node.end_position().column as u32,
                    text: node_text,
                    children_count: node.child_count() as u32,
                    is_named: node.is_named(),
                };

                nodes.push(ast_node);
            }
        }

        // Recursively process children with depth limit
        if nodes.len() < options.max_depth as usize * 1000 { // Rough depth estimation
            for i in 0..node.child_count() {
                if let Some(child) = node.child(i) {
                    self.extract_nodes_recursive(child, source_code, nodes, error_count, options);
                }
            }
        }
    }

    /// Execute Tree-sitter query pattern on parsed code
    pub fn query_ast(
        &self,
        source_code: &str,
        language: SupportedLanguage,
        query_pattern: &str,
    ) -> Result<Vec<QueryMatchResult>, EngineError> {
        let mut parser = self.parser_pool.get_parser(language.clone())?;
        
        let tree = parser.parse(source_code, None)
            .ok_or_else(|| EngineError::ASTProcessing(ASTProcessingError::Parsing { 
                file: "query_source".to_string(),
                error: "Failed to parse source code for querying".to_string()
            }))?;

        // Create query for pattern matching
        let query = self.create_query(language.clone(), query_pattern)?;
        
        let mut cursor = QueryCursor::new();
        let mut matches = Vec::new();
        for query_match in cursor.matches(&query, tree.root_node(), source_code.as_bytes()) {
            matches.push(query_match);
        }

        let mut results = Vec::new();
        
        for query_match in matches {
            let mut captures = Vec::new();
            let mut match_texts = Vec::new();

            for capture in query_match.captures {
                let node = capture.node;
                let node_text = node.utf8_text(source_code.as_bytes())
                    .unwrap_or("[invalid utf8]")
                    .to_string();

                match_texts.push(node_text.clone());

                let ast_node = AstNode {
                    node_type: node.kind().to_string(),
                    start_byte: node.start_byte() as u32,
                    end_byte: node.end_byte() as u32,
                    start_row: node.start_position().row as u32,
                    end_row: node.end_position().row as u32,
                    start_column: node.start_position().column as u32,
                    end_column: node.end_position().column as u32,
                    text: node_text,
                    children_count: node.child_count() as u32,
                    is_named: node.is_named(),
                };

                captures.push(ast_node);
            }

            results.push(QueryMatchResult {
                pattern_index: query_match.pattern_index as u32,
                captures,
                match_text: match_texts.join(" | "),
            });
        }

        // Return parser to pool
        self.parser_pool.return_parser(language, parser);

        Ok(results)
    }

    /// Create query for the given language and pattern
    fn create_query(
        &self,
        language: SupportedLanguage,
        pattern: &str,
    ) -> Result<Query, EngineError> {
        let tree_sitter_lang = match language {
            SupportedLanguage::TypeScript => unsafe { tree_sitter_typescript() },
            SupportedLanguage::JavaScript => unsafe { tree_sitter_javascript() },
            SupportedLanguage::Python => unsafe { tree_sitter_python() },
            SupportedLanguage::Rust => unsafe { tree_sitter_rust() },
            SupportedLanguage::Java => unsafe { tree_sitter_java() },
            SupportedLanguage::Cpp => unsafe { tree_sitter_cpp() },
        };

        let query = Query::new(&tree_sitter_lang, pattern)
            .map_err(|e| EngineError::ASTProcessing(ASTProcessingError::TreeSitter(format!("Invalid query pattern: {}", e))))?;

        Ok(query)
    }

    /// Process multiple files in parallel
    pub async fn process_files_batch(
        &self,
        files: Vec<(String, String, SupportedLanguage)>, // (content, path, language)
        options: ProcessingOptions,
    ) -> Result<Vec<AstProcessingResult>, EngineError> {
        use tokio::task::spawn_blocking;
        
        let processor = Arc::new(self);
        let mut tasks = Vec::new();

        for (content, path, language) in files {
            let processor_clone = processor.clone();
            let options_clone = options.clone();
            
            let task = spawn_blocking(move || {
                processor_clone.parse_code(&content, language, &path, &options_clone)
            });
            
            tasks.push(task);
        }

        let mut results = Vec::new();
        for task in tasks {
            let result = task.await
                .map_err(|e| EngineError::ASTProcessing(ASTProcessingError::TreeSitter(format!("Task join error: {}", e))))?;
            results.push(result?);
        }

        Ok(results)
    }
}

// NAPI bindings for TypeScript integration
#[napi]
pub struct NapiAstProcessor {
    processor: AstProcessor,
}

#[napi]
impl NapiAstProcessor {
    #[napi(constructor)]
    pub fn new(max_parsers_per_language: Option<u32>) -> Self {
        let max_parsers = max_parsers_per_language.unwrap_or(4) as usize;
        Self {
            processor: AstProcessor::new(max_parsers),
        }
    }

    /// Parse source code and return AST nodes
    #[napi]
    pub fn parse_code(
        &self,
        source_code: String,
        language: SupportedLanguage,
        file_path: String,
        options: ProcessingOptions,
    ) -> Result<AstProcessingResult, napi::Error> {
        self.processor
            .parse_code(&source_code, language, &file_path, &options)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Execute Tree-sitter query pattern
    #[napi]
    pub fn query_ast(
        &self,
        source_code: String,
        language: SupportedLanguage,
        query_pattern: String,
    ) -> Result<Vec<QueryMatchResult>, napi::Error> {
        self.processor
            .query_ast(&source_code, language, &query_pattern)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Process multiple files in parallel
    #[napi]
    pub async fn process_files_batch(
        &self,
        files_json: String, // JSON string: [{"content": "...", "path": "...", "language": "..."}]
        options: ProcessingOptions,
    ) -> Result<Vec<AstProcessingResult>, napi::Error> {
        #[derive(Deserialize)]
        struct FileInput {
            content: String,
            path: String,
            language: SupportedLanguage,
        }

        let file_inputs: Vec<FileInput> = serde_json::from_str(&files_json)
            .map_err(|e| napi::Error::from_reason(format!("Invalid files JSON: {}", e)))?;

        let files: Vec<(String, String, SupportedLanguage)> = file_inputs
            .into_iter()
            .map(|f| (f.content, f.path, f.language))
            .collect();

        self.processor
            .process_files_batch(files, options)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ast_processor_creation() {
        let processor = AstProcessor::new(4);
        assert_eq!(processor.parser_pool.max_pool_size, 4);
    }

    #[test]
    fn test_parser_pool() {
        let pool = ParserPool::new(2);
        
        // Get parser for TypeScript
        let parser1 = pool.get_parser(SupportedLanguage::TypeScript);
        assert!(parser1.is_ok());
        
        // Return parser to pool
        pool.return_parser(SupportedLanguage::TypeScript, parser1.unwrap());
        
        // Get parser again (should reuse from pool)
        let parser2 = pool.get_parser(SupportedLanguage::TypeScript);
        assert!(parser2.is_ok());
    }

    #[test]
    fn test_simple_javascript_parsing() {
        let processor = AstProcessor::new(1);
        let source = "function hello() { return 'world'; }";
        let options = ProcessingOptions {
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            batch_size: 100,
            enable_caching: true,
        };

        let result = processor.parse_code(
            source,
            SupportedLanguage::JavaScript,
            "test.js",
            &options,
        );

        assert!(result.is_ok());
        let ast_result = result.unwrap();
        assert_eq!(ast_result.language, "JavaScript");
        assert_eq!(ast_result.file_path, "test.js");
        assert!(ast_result.nodes.len() > 0);
        assert_eq!(ast_result.error_count, 0);
    }

    #[test]
    fn test_typescript_parsing() {
        let processor = AstProcessor::new(1);
        let source = "interface User { name: string; age: number; }";
        let options = ProcessingOptions {
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            batch_size: 100,
            enable_caching: true,
        };

        let result = processor.parse_code(
            source,
            SupportedLanguage::TypeScript,
            "test.ts",
            &options,
        );

        assert!(result.is_ok());
        let ast_result = result.unwrap();
        assert_eq!(ast_result.language, "TypeScript");
        assert!(ast_result.nodes.len() > 0);
    }

    #[test]
    fn test_python_parsing() {
        let processor = AstProcessor::new(1);
        let source = "def greet(name): return f'Hello, {name}!'";
        let options = ProcessingOptions {
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            batch_size: 100,
            enable_caching: true,
        };

        let result = processor.parse_code(
            source,
            SupportedLanguage::Python,
            "test.py",
            &options,
        );

        assert!(result.is_ok());
        let ast_result = result.unwrap();
        assert_eq!(ast_result.language, "Python");
        assert!(ast_result.nodes.len() > 0);
    }

    #[test]
    fn test_ast_node_creation() {
        let node = AstNode {
            node_type: "function_declaration".to_string(),
            start_byte: 0,
            end_byte: 30,
            start_row: 0,
            end_row: 0,
            start_column: 0,
            end_column: 30,
            text: "function test() {}".to_string(),
            children_count: 3,
            is_named: true,
        };

        assert_eq!(node.node_type, "function_declaration");
        assert_eq!(node.text, "function test() {}");
        assert!(node.is_named);
    }

    #[tokio::test]
    async fn test_batch_processing() {
        let processor = AstProcessor::new(2);
        let files = vec![
            ("function a() {}".to_string(), "a.js".to_string(), SupportedLanguage::JavaScript),
            ("def b(): pass".to_string(), "b.py".to_string(), SupportedLanguage::Python),
        ];
        
        let options = ProcessingOptions {
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            batch_size: 100,
            enable_caching: true,
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
}