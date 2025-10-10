use crate::ast_processor::{AstProcessingResult, AstProcessor, SupportedLanguage};
use crate::language_config::LanguageConfig;
use crate::types::ProcessingOptions;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;

#[cfg(not(target_arch = "wasm32"))]
use tokio::fs;

/// High-level parsing interface for the Rust core engine
#[derive(Clone)]
pub struct RustParser {
    processor: Arc<AstProcessor>,
}

/// Request for parsing a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseRequest {
    pub source_code: String,
    pub file_path: String,
    pub language: Option<SupportedLanguage>, // Auto-detect if None
}

/// Request for batch parsing multiple files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchParseRequest {
    pub files: Vec<ParseRequest>,
    pub options: ProcessingOptions,
}

/// Result from parsing operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub success: bool,
    pub result: Option<AstProcessingResult>,
    pub error: Option<String>,
}

impl ParseResult {
    /// Check if the parsing was successful
    pub fn is_ok(&self) -> bool {
        self.success
    }
}

/// Result from batch parsing operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchParseResult {
    pub success: bool,
    pub results: Vec<ParseResult>,
    pub total_files: usize,
    pub successful_files: usize,
    pub total_processing_time_ms: u32,
}

impl RustParser {
    /// Create a new parser instance with specified pool size
    pub fn new(max_parsers_per_language: usize) -> Self {
        Self {
            processor: Arc::new(AstProcessor::new(max_parsers_per_language)),
        }
    }

    /// Parse a single source code string with language detection
    pub fn parse(&self, request: ParseRequest) -> ParseResult {
        let language = match request.language {
            Some(lang) => lang,
            None => {
                // Auto-detect language from file extension
                if let Some(extension) = Path::new(&request.file_path)
                    .extension()
                    .and_then(|ext| ext.to_str())
                {
                    match LanguageConfig::detect_language_from_extension(extension) {
                        Some(lang) => lang,
                        None => {
                            return ParseResult {
                                success: false,
                                result: None,
                                error: Some(format!("Unsupported file extension: {}", extension)),
                            };
                        }
                    }
                } else {
                    return ParseResult {
                        success: false,
                        result: None,
                        error: Some("Unable to detect language from file path".to_string()),
                    };
                }
            }
        };

        let options = ProcessingOptions::default();

        match self.processor.parse_code(
            &request.source_code,
            language,
            &request.file_path,
            &options,
        ) {
            Ok(result) => ParseResult {
                success: true,
                result: Some(result),
                error: None,
            },
            Err(error) => ParseResult {
                success: false,
                result: None,
                error: Some(format!("Parse error: {}", error)),
            },
        }
    }

    /// Parse multiple files in parallel for high performance
    pub async fn parse_batch(&self, request: BatchParseRequest) -> BatchParseResult {
        let start_time = std::time::Instant::now();
        let total_files = request.files.len();
        let mut results = Vec::new();
        let mut successful_files = 0;

        // Prepare files for batch processing
        let mut batch_files = Vec::new();

        for file_request in request.files {
            let language = match file_request.language {
                Some(lang) => lang,
                None => {
                    // Auto-detect language from file extension
                    if let Some(extension) = Path::new(&file_request.file_path)
                        .extension()
                        .and_then(|ext| ext.to_str())
                    {
                        match LanguageConfig::detect_language_from_extension(extension) {
                            Some(lang) => lang,
                            None => {
                                results.push(ParseResult {
                                    success: false,
                                    result: None,
                                    error: Some(format!(
                                        "Unsupported file extension: {}",
                                        extension
                                    )),
                                });
                                continue;
                            }
                        }
                    } else {
                        results.push(ParseResult {
                            success: false,
                            result: None,
                            error: Some("Unable to detect language from file path".to_string()),
                        });
                        continue;
                    }
                }
            };

            batch_files.push((file_request.source_code, file_request.file_path, language));
        }

        // Process files in parallel using the processor's batch method
        match self
            .processor
            .clone()
            .process_files_batch(batch_files.clone(), request.options.clone())
            .await
        {
            Ok(batch_results) => {
                for result in batch_results {
                    results.push(ParseResult {
                        success: true,
                        result: Some(result),
                        error: None,
                    });
                    successful_files += 1;
                }
            }
            Err(_error) => {
                // If batch processing fails, fall back to individual parsing
                for (source_code, file_path, language) in batch_files {
                    match self.processor.parse_code(
                        &source_code,
                        language,
                        &file_path,
                        &request.options,
                    ) {
                        Ok(result) => {
                            results.push(ParseResult {
                                success: true,
                                result: Some(result),
                                error: None,
                            });
                            successful_files += 1;
                        }
                        Err(err) => {
                            results.push(ParseResult {
                                success: false,
                                result: None,
                                error: Some(format!("Parse error: {}", err)),
                            });
                        }
                    }
                }
            }
        }

        let total_processing_time = start_time.elapsed().as_millis() as u32;

        BatchParseResult {
            success: successful_files > 0,
            results,
            total_files,
            successful_files,
            total_processing_time_ms: total_processing_time,
        }
    }

    /// Parse file from disk with automatic language detection
    #[cfg(feature = "full-system")]
    pub async fn parse_file(&self, file_path: &str) -> ParseResult {
        match fs::read_to_string(file_path).await {
            Ok(source_code) => {
                let request = ParseRequest {
                    source_code,
                    file_path: file_path.to_string(),
                    language: None, // Auto-detect
                };
                self.parse(request)
            }
            Err(error) => ParseResult {
                success: false,
                result: None,
                error: Some(format!("Failed to read file: {}", error)),
            },
        }
    }

    /// Parse multiple files from disk in parallel
    #[cfg(feature = "full-system")]
    pub async fn parse_files(
        &self,
        file_paths: Vec<String>,
        options: ProcessingOptions,
    ) -> BatchParseResult {
        let mut requests = Vec::new();

        for file_path in file_paths {
            match fs::read_to_string(&file_path).await {
                Ok(source_code) => {
                    requests.push(ParseRequest {
                        source_code,
                        file_path,
                        language: None, // Auto-detect
                    });
                }
                Err(_) => {
                    // Skip files that can't be read
                    continue;
                }
            }
        }

        let batch_request = BatchParseRequest {
            files: requests,
            options,
        };

        self.parse_batch(batch_request).await
    }

    /// Get supported languages
    pub fn supported_languages() -> Vec<SupportedLanguage> {
        SupportedLanguage::all()
    }

    /// Check if a language is supported
    pub fn is_language_supported(language: &SupportedLanguage) -> bool {
        SupportedLanguage::all().contains(language)
    }

    /// Get file extensions supported by this parser
    pub fn supported_extensions() -> Vec<String> {
        let mut extensions = Vec::new();
        for language in SupportedLanguage::all() {
            for ext in language.extensions() {
                extensions.push(ext.to_string());
            }
        }
        extensions.sort();
        extensions.dedup();
        extensions
    }

    /// Get parser statistics
    pub fn get_stats(&self) -> serde_json::Value {
        let stats = self.processor.get_stats();
        serde_json::json!({
            "total_parsers": stats.total_parsers,
            "languages_available": stats.languages_available,
            "max_pool_size": stats.max_pool_size,
            "supported_languages": SupportedLanguage::all().len(),
            "supported_extensions": Self::supported_extensions().len()
        })
    }
}

impl Default for RustParser {
    fn default() -> Self {
        // Default to 4 parsers per language for good parallelism
        Self::new(4)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ProcessingOptions;

    #[test]
    fn test_rust_parser_creation() {
        let parser = RustParser::new(2);
        let stats = parser.get_stats();
        assert!(stats["max_pool_size"].as_u64().unwrap() == 2);
    }

    #[test]
    fn test_supported_languages() {
        let languages = RustParser::supported_languages();
        assert!(!languages.is_empty());
        assert!(languages.contains(&SupportedLanguage::JavaScript));
        assert!(languages.contains(&SupportedLanguage::Python));
    }

    #[test]
    fn test_language_support_check() {
        assert!(RustParser::is_language_supported(
            &SupportedLanguage::JavaScript
        ));
        assert!(RustParser::is_language_supported(
            &SupportedLanguage::Python
        ));
        assert!(RustParser::is_language_supported(&SupportedLanguage::Rust));
    }

    #[test]
    fn test_supported_extensions() {
        let extensions = RustParser::supported_extensions();
        assert!(extensions.contains(&"js".to_string()));
        assert!(extensions.contains(&"py".to_string()));
        assert!(extensions.contains(&"rs".to_string()));
        assert!(extensions.contains(&"java".to_string()));
        assert!(extensions.contains(&"go".to_string()));
    }

    #[test]
    fn test_parse_javascript() {
        let parser = RustParser::new(1);
        let request = ParseRequest {
            source_code: "function hello() { return 'world'; }".to_string(),
            file_path: "test.js".to_string(),
            language: Some(SupportedLanguage::JavaScript),
        };

        let result = parser.parse(request);
        assert!(result.success);
        assert!(result.result.is_some());
        assert!(result.error.is_none());

        let ast_result = result.result.unwrap();
        assert_eq!(ast_result.language, "JavaScript");
        assert_eq!(ast_result.file_path, "test.js");
        assert!(!ast_result.nodes.is_empty());
    }

    #[test]
    fn test_parse_with_auto_detection() {
        let parser = RustParser::new(1);
        let request = ParseRequest {
            source_code: "def hello(): return 'world'".to_string(),
            file_path: "test.py".to_string(),
            language: None, // Auto-detect from extension
        };

        let result = parser.parse(request);
        assert!(result.success);
        assert!(result.result.is_some());

        let ast_result = result.result.unwrap();
        assert_eq!(ast_result.language, "Python");
    }

    #[test]
    fn test_unsupported_extension() {
        let parser = RustParser::new(1);
        let request = ParseRequest {
            source_code: "some code".to_string(),
            file_path: "test.unknown".to_string(),
            language: None,
        };

        let result = parser.parse(request);
        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("Unsupported file extension"));
    }

    #[tokio::test]
    async fn test_batch_parsing() {
        let parser = RustParser::new(2);
        let requests = vec![
            ParseRequest {
                source_code: "function a() {}".to_string(),
                file_path: "a.js".to_string(),
                language: Some(SupportedLanguage::JavaScript),
            },
            ParseRequest {
                source_code: "def b(): pass".to_string(),
                file_path: "b.py".to_string(),
                language: Some(SupportedLanguage::Python),
            },
        ];

        let batch_request = BatchParseRequest {
            files: requests,
            options: ProcessingOptions::default(),
        };

        let result = parser.parse_batch(batch_request).await;
        assert!(result.success);
        assert_eq!(result.total_files, 2);
        assert_eq!(result.successful_files, 2);
        assert_eq!(result.results.len(), 2);
    }

    #[test]
    fn test_parser_stats() {
        let parser = RustParser::new(3);
        let stats = parser.get_stats();

        assert!(stats["max_pool_size"].as_u64().unwrap() == 3);
        assert!(stats["supported_languages"].as_u64().unwrap() > 0);
        assert!(stats["supported_extensions"].as_u64().unwrap() > 0);
    }
}
