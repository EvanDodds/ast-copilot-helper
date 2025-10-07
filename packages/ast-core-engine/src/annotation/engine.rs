//! Main annotation engine that orchestrates the annotation generation process

use super::{
    complexity::ComplexityAnalyzer, dependency::DependencyAnalyzer, extractors::*, types::*,
};
use crate::types::ASTNode;
use std::collections::HashMap;
use std::sync::Arc;

/// Main annotation engine that orchestrates annotation generation
pub struct AnnotationEngine {
    /// Language-specific extractors
    extractors: HashMap<String, Arc<dyn LanguageExtractor>>,
    /// Complexity analyzer
    complexity_analyzer: ComplexityAnalyzer,
    /// Dependency analyzer  
    dependency_analyzer: DependencyAnalyzer,
    /// Configuration settings
    config: AnnotationConfig,
}

impl AnnotationEngine {
    /// Create a new annotation engine with default extractors
    pub fn new() -> Self {
        let mut extractors: HashMap<String, Arc<dyn LanguageExtractor>> = HashMap::new();

        // Register default language extractors
        extractors.insert("typescript".to_string(), Arc::new(TypeScriptExtractor));
        extractors.insert("javascript".to_string(), Arc::new(JavaScriptExtractor));
        extractors.insert("python".to_string(), Arc::new(PythonExtractor));
        extractors.insert("rust".to_string(), Arc::new(RustExtractor));
        extractors.insert("java".to_string(), Arc::new(JavaExtractor));

        Self {
            extractors,
            complexity_analyzer: ComplexityAnalyzer::new(),
            dependency_analyzer: DependencyAnalyzer::new(),
            config: AnnotationConfig::default(),
        }
    }

    /// Create a new annotation engine with custom configuration
    pub fn with_config(config: AnnotationConfig) -> Self {
        let mut engine = Self::new();
        engine.config = config;
        engine
    }

    /// Register a custom language extractor
    pub fn register_extractor(&mut self, language: String, extractor: Arc<dyn LanguageExtractor>) {
        self.extractors.insert(language, extractor);
    }

    /// Generate annotations for a single AST node
    pub fn annotate_node(
        &self,
        node: &ASTNode,
        language: &str,
        source_text: &str,
        file_path: &str,
    ) -> AnnotationResult<Annotation> {
        // Get the appropriate language extractor
        let extractor = self
            .extractors
            .get(language)
            .ok_or_else(|| AnnotationError::UnsupportedLanguage(language.to_string()))?;

        // Extract signature and metadata
        let signature = extractor.extract_signature(node, source_text);
        let parameters = extractor.extract_parameters(node, source_text);
        let return_type = extractor.extract_return_type(node, source_text);
        let modifiers = extractor.extract_modifiers(node, source_text);
        let semantic_tags = extractor.extract_semantic_tags(node, source_text);
        let summary = extractor.generate_summary(node, &signature, source_text);

        // Analyze complexity if enabled
        let complexity_metrics = if self.config.include_complexity {
            Some(self.complexity_analyzer.analyze_node(node, source_text))
        } else {
            None
        };

        // Analyze dependencies if enabled
        let dependencies = if self.config.include_dependencies {
            Some(
                self.dependency_analyzer
                    .analyze_node(node, source_text, file_path),
            )
        } else {
            None
        };

        Ok(Annotation {
            node_type: node.node_type.clone(),
            signature,
            parameters,
            return_type,
            modifiers,
            complexity_metrics,
            dependencies,
            semantic_tags,
            summary,
            start_line: node.start_point.row + 1, // Convert to 1-based line numbers
            end_line: node.end_point.row + 1,
            language: language.to_string(),
        })
    }

    /// Generate annotations for multiple AST nodes
    pub fn annotate_nodes(
        &self,
        nodes: &[ASTNode],
        language: &str,
        source_text: &str,
        file_path: &str,
    ) -> AnnotationResult<Vec<Annotation>> {
        let mut annotations = Vec::new();

        for node in nodes {
            match self.annotate_node(node, language, source_text, file_path) {
                Ok(annotation) => annotations.push(annotation),
                Err(e) => {
                    if self.config.continue_on_error {
                        eprintln!("Warning: Failed to annotate node {}: {}", node.node_type, e);
                        continue;
                    } else {
                        return Err(e);
                    }
                }
            }
        }

        Ok(annotations)
    }

    /// Filter nodes based on configuration settings
    pub fn filter_nodes<'a>(&self, nodes: &'a [ASTNode]) -> Vec<&'a ASTNode> {
        nodes
            .iter()
            .filter(|node| self.should_annotate_node(node))
            .collect()
    }

    /// Determine if a node should be annotated based on configuration
    fn should_annotate_node(&self, node: &ASTNode) -> bool {
        // Skip nodes that are too small if min_lines is configured
        if let Some(min_lines) = self.config.min_lines {
            let line_count = node.end_point.row - node.start_point.row + 1;
            if line_count < min_lines {
                return false;
            }
        }

        // Skip nodes that are too large if max_lines is configured
        if let Some(max_lines) = self.config.max_lines {
            let line_count = node.end_point.row - node.start_point.row + 1;
            if line_count > max_lines {
                return false;
            }
        }

        // Check if node type is in the include list
        if !self.config.included_node_types.is_empty()
            && !self.config.included_node_types.contains(&node.node_type)
        {
            return false;
        }

        // Check if node type is in the exclude list
        if self.config.excluded_node_types.contains(&node.node_type) {
            return false;
        }

        true
    }

    /// Generate a file-level summary from annotations
    pub fn generate_file_summary(
        &self,
        annotations: &[Annotation],
        file_path: &str,
    ) -> FileSummary {
        let total_annotations = annotations.len();
        let mut complexity_distribution = HashMap::new();
        let mut node_type_counts = HashMap::new();
        let mut all_dependencies = std::collections::HashSet::new();
        let mut all_semantic_tags = std::collections::HashSet::new();

        // Aggregate statistics from all annotations
        for annotation in annotations {
            // Count node types
            *node_type_counts
                .entry(annotation.node_type.clone())
                .or_insert(0) += 1;

            // Aggregate complexity
            if let Some(metrics) = &annotation.complexity_metrics {
                let complexity_level =
                    super::complexity::ComplexityClassifier::assess_overall_complexity(metrics);
                *complexity_distribution
                    .entry(complexity_level.to_string())
                    .or_insert(0) += 1;
            }

            // Aggregate dependencies
            if let Some(deps) = &annotation.dependencies {
                all_dependencies.extend(deps.external_dependencies.iter().cloned());
            }

            // Aggregate semantic tags
            all_semantic_tags.extend(annotation.semantic_tags.iter().cloned());
        }

        FileSummary {
            file_path: file_path.to_string(),
            total_annotations,
            node_type_counts,
            complexity_distribution,
            external_dependencies: all_dependencies.into_iter().collect(),
            semantic_tags: all_semantic_tags.into_iter().collect(),
            language: annotations
                .first()
                .map(|a| a.language.clone())
                .unwrap_or_default(),
        }
    }

    /// Get supported languages
    pub fn supported_languages(&self) -> Vec<String> {
        self.extractors.keys().cloned().collect()
    }

    /// Get current configuration
    pub fn config(&self) -> &AnnotationConfig {
        &self.config
    }

    /// Update configuration
    pub fn set_config(&mut self, config: AnnotationConfig) {
        self.config = config;
    }
}

impl Default for AnnotationEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// File-level summary information
#[derive(Debug, Clone)]
pub struct FileSummary {
    pub file_path: String,
    pub total_annotations: usize,
    pub node_type_counts: HashMap<String, usize>,
    pub complexity_distribution: HashMap<String, usize>,
    pub external_dependencies: Vec<String>,
    pub semantic_tags: Vec<SemanticTag>,
    pub language: String,
}

/// Factory for creating pre-configured annotation engines
pub struct AnnotationEngineFactory;

impl AnnotationEngineFactory {
    /// Create an engine optimized for fast annotation (minimal analysis)
    pub fn create_fast() -> AnnotationEngine {
        let config = AnnotationConfig {
            include_complexity: false,
            include_dependencies: false,
            continue_on_error: true,
            min_lines: Some(1),
            max_lines: None,
            included_node_types: vec![
                "function_declaration".to_string(),
                "method_definition".to_string(),
                "class_declaration".to_string(),
            ],
            excluded_node_types: vec![],
        };

        AnnotationEngine::with_config(config)
    }

    /// Create an engine optimized for comprehensive analysis
    pub fn create_comprehensive() -> AnnotationEngine {
        let config = AnnotationConfig {
            include_complexity: true,
            include_dependencies: true,
            continue_on_error: true,
            min_lines: None,
            max_lines: None,
            included_node_types: vec![],
            excluded_node_types: vec!["whitespace".to_string(), "comment".to_string()],
        };

        AnnotationEngine::with_config(config)
    }

    /// Create an engine for functions and methods only
    pub fn create_functions_only() -> AnnotationEngine {
        let config = AnnotationConfig {
            include_complexity: true,
            include_dependencies: false,
            continue_on_error: true,
            min_lines: Some(2),
            max_lines: None,
            included_node_types: vec![
                "function_declaration".to_string(),
                "function_expression".to_string(),
                "arrow_function".to_string(),
                "method_definition".to_string(),
                "function_item".to_string(),
            ],
            excluded_node_types: vec![],
        };

        AnnotationEngine::with_config(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Point;

    fn create_test_node(node_type: &str, text: &str) -> ASTNode {
        ASTNode {
            node_type: node_type.to_string(),
            text: text.to_string(),
            start_point: Point { row: 0, column: 0 },
            end_point: Point {
                row: 0,
                column: text.len() as u32,
            },
            children: vec![],
        }
    }

    #[test]
    fn test_annotation_engine_creation() {
        let engine = AnnotationEngine::new();
        let languages = engine.supported_languages();

        assert!(languages.contains(&"typescript".to_string()));
        assert!(languages.contains(&"javascript".to_string()));
        assert!(languages.contains(&"python".to_string()));
        assert!(languages.contains(&"rust".to_string()));
    }

    #[test]
    fn test_node_annotation() {
        let engine = AnnotationEngine::new();
        let node = create_test_node("function_declaration", "function test() { return 42; }");

        let annotation = engine
            .annotate_node(
                &node,
                "javascript",
                "function test() { return 42; }",
                "test.js",
            )
            .unwrap();

        assert_eq!(annotation.node_type, "function_declaration");
        assert!(!annotation.signature.is_empty());
        assert_eq!(annotation.language, "javascript");
    }

    #[test]
    fn test_factory_configurations() {
        let fast_engine = AnnotationEngineFactory::create_fast();
        assert!(!fast_engine.config().include_complexity);
        assert!(!fast_engine.config().include_dependencies);

        let comprehensive_engine = AnnotationEngineFactory::create_comprehensive();
        assert!(comprehensive_engine.config().include_complexity);
        assert!(comprehensive_engine.config().include_dependencies);
    }

    #[test]
    fn test_unsupported_language() {
        let engine = AnnotationEngine::new();
        let node = create_test_node("function", "def test(): pass");

        let result = engine.annotate_node(&node, "unsupported", "", "");
        assert!(matches!(
            result,
            Err(AnnotationError::UnsupportedLanguage(_))
        ));
    }
}
