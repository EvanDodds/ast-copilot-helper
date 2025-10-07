//! AST Parser CLI
//!
//! Command-line interface for the Rust AST parser engine.
//! This binary provides fast parsing capabilities for TypeScript CLI integration.

use ast_helper_core_engine::{
    ast_processor::SupportedLanguage,
    parse_interface::{BatchParseRequest, ParseRequest, RustParser},
    types::{ASTNode, Point},
    AnnotationEngine, ComplexityAnalyzer, DependencyAnalyzer,
};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, BufRead},
    path::PathBuf,
    process,
};

#[derive(Parser)]
#[command(
    name = "ast-parser",
    about = "High-performance AST parser for multiple programming languages",
    version = env!("CARGO_PKG_VERSION")
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Maximum number of parsers per language (default: 4)
    #[arg(long, global = true, default_value_t = 4)]
    max_parsers: usize,

    /// Enable verbose output
    #[arg(short, long, global = true)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Parse a single file
    Parse {
        /// File path to parse
        #[arg(short, long, required_unless_present = "stdin")]
        file: Option<PathBuf>,

        /// Language override (auto-detected if not specified)
        #[arg(short, long)]
        language: Option<String>,

        /// Read source from stdin instead of file
        #[arg(long)]
        stdin: bool,
    },

    /// Parse multiple files in batch
    Batch {
        /// JSON file containing batch parse request
        #[arg(short, long)]
        request_file: Option<PathBuf>,

        /// Read batch request from stdin
        #[arg(long)]
        stdin: bool,
    },

    /// List supported languages and extensions
    Languages,

    /// Check if a language is supported
    CheckLanguage {
        /// Language to check
        language: String,
    },

    /// Get parser statistics
    Stats,

    /// Generate comprehensive annotations for a file
    Annotate {
        /// File path to annotate
        #[arg(short, long, required_unless_present = "stdin")]
        file: Option<PathBuf>,

        /// Language override (auto-detected if not specified)
        #[arg(short, long)]
        language: Option<String>,

        /// Read source from stdin instead of file
        #[arg(long)]
        stdin: bool,

        /// Output format: json, yaml, or summary
        #[arg(long, default_value = "json")]
        format: String,
    },

    /// Analyze code complexity metrics
    AnalyzeComplexity {
        /// File path to analyze
        #[arg(short, long, required_unless_present = "stdin")]
        file: Option<PathBuf>,

        /// Language override (auto-detected if not specified)
        #[arg(short, long)]
        language: Option<String>,

        /// Read source from stdin instead of file
        #[arg(long)]
        stdin: bool,

        /// Output format: json, yaml, or summary
        #[arg(long, default_value = "summary")]
        format: String,
    },

    /// Analyze dependency relationships
    AnalyzeDependencies {
        /// File path to analyze
        #[arg(short, long, required_unless_present = "stdin")]
        file: Option<PathBuf>,

        /// Language override (auto-detected if not specified)
        #[arg(short, long)]
        language: Option<String>,

        /// Read source from stdin instead of file
        #[arg(long)]
        stdin: bool,

        /// Output format: json, yaml, or summary
        #[arg(long, default_value = "summary")]
        format: String,
    },
}

#[derive(Serialize, Deserialize)]
struct CliParseRequest {
    pub source_code: String,
    pub file_path: String,
    pub language: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct CliBatchRequest {
    pub files: Vec<CliParseRequest>,
    pub max_concurrency: Option<usize>,
}

#[derive(Serialize)]
struct CliResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> CliResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

fn string_to_language(lang_str: &str) -> Option<SupportedLanguage> {
    match lang_str.to_lowercase().as_str() {
        "javascript" | "js" => Some(SupportedLanguage::JavaScript),
        "typescript" | "ts" => Some(SupportedLanguage::TypeScript),
        "python" | "py" => Some(SupportedLanguage::Python),
        "rust" | "rs" => Some(SupportedLanguage::Rust),
        "java" => Some(SupportedLanguage::Java),
        "cpp" | "c++" => Some(SupportedLanguage::Cpp),
        "c" => Some(SupportedLanguage::C),
        "csharp" | "c#" | "cs" => Some(SupportedLanguage::CSharp),
        "go" => Some(SupportedLanguage::Go),
        _ => None,
    }
}

fn output_json<T: Serialize>(response: CliResponse<T>) -> io::Result<()> {
    let json = serde_json::to_string(&response)?;
    println!("{}", json);
    Ok(())
}

async fn handle_parse(
    parser: &RustParser,
    file: Option<PathBuf>,
    language: Option<String>,
    stdin: bool,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (source_code, file_path) = if stdin {
        let mut input = String::new();
        let stdin = io::stdin();
        for line in stdin.lock().lines() {
            input.push_str(&line?);
            input.push('\n');
        }
        (input, "<stdin>".to_string())
    } else {
        let file_path = file.ok_or("File path required when not using stdin")?;
        let source_code = fs::read_to_string(&file_path)?;
        (source_code, file_path.to_string_lossy().to_string())
    };

    let lang = language.as_ref().and_then(|l| string_to_language(l));

    if verbose {
        eprintln!("Parsing file: {}", file_path);
        if let Some(ref l) = language {
            eprintln!("Language override: {}", l);
        }
    }

    let request = ParseRequest {
        source_code,
        file_path,
        language: lang,
    };

    let result = parser.parse(request);

    if result.success {
        output_json(CliResponse::success(result))?;
    } else {
        let error_msg = result
            .error
            .unwrap_or_else(|| "Unknown parsing error".to_string());
        output_json(CliResponse::<()>::error(error_msg))?;
        process::exit(1);
    }

    Ok(())
}

async fn handle_batch(
    parser: &RustParser,
    request_file: Option<PathBuf>,
    stdin: bool,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let request_json = if stdin {
        let mut input = String::new();
        let stdin = io::stdin();
        for line in stdin.lock().lines() {
            input.push_str(&line?);
            input.push('\n');
        }
        input
    } else {
        let file_path = request_file.ok_or("Request file path required when not using stdin")?;
        fs::read_to_string(file_path)?
    };

    let cli_request: CliBatchRequest = serde_json::from_str(&request_json)?;

    if verbose {
        eprintln!(
            "Processing batch request with {} files",
            cli_request.files.len()
        );
    }

    // Convert CLI request to internal format
    use ast_helper_core_engine::types::ProcessingOptions;

    let mut options = ProcessingOptions::default();
    if let Some(concurrency) = cli_request.max_concurrency {
        options.parallel_workers = concurrency as u32;
    }

    let batch_request = BatchParseRequest {
        files: cli_request
            .files
            .into_iter()
            .map(|f| ParseRequest {
                source_code: f.source_code,
                file_path: f.file_path,
                language: f.language.and_then(|l| string_to_language(&l)),
            })
            .collect(),
        options,
    };

    let result = parser.parse_batch(batch_request).await;

    if result.success {
        output_json(CliResponse::success(result))?;
    } else {
        let error_msg = format!(
            "Batch parsing failed. Successfully parsed {} of {} files",
            result.successful_files, result.total_files
        );
        output_json(CliResponse::<()>::error(error_msg))?;
        process::exit(1);
    }

    Ok(())
}

async fn handle_annotate(
    parser: &RustParser,
    file: Option<PathBuf>,
    language: Option<String>,
    stdin: bool,
    format: &str,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (source_code, file_path) = get_source_input(file, stdin)?;
    let lang = language.as_ref().and_then(|l| string_to_language(l));

    if verbose {
        eprintln!("Generating annotations for: {}", file_path);
    }

    // Parse the file first
    let request = ParseRequest {
        source_code: source_code.clone(),
        file_path: file_path.clone(),
        language: lang.clone(),
    };

    let parse_result = parser.parse(request);

    if !parse_result.success {
        return Err(parse_result
            .error
            .unwrap_or("Parse failed".to_string())
            .into());
    }

    let ast_result = parse_result.result.ok_or("No parse result")?;

    // Create annotation engine and analyze
    let engine = AnnotationEngine::new();
    let language_str = lang
        .map(|l| format!("{:?}", l).to_lowercase())
        .unwrap_or_else(|| ast_result.language.to_lowercase());

    // Convert the parsed nodes to ASTNode format for annotation
    let ast_nodes: Vec<ASTNode> = ast_result
        .nodes
        .iter()
        .enumerate()
        .map(|(index, node)| ASTNode {
            id: (index as u32).to_string(), // Use index as ID since AstNode doesn't have id
            node_type: node.node_type.clone(),
            text: node.text.clone(),
            start_point: Point {
                row: node.start_row,
                column: node.start_column,
            },
            end_point: Point {
                row: node.end_row,
                column: node.end_column,
            },
            start_byte: node.start_byte,
            end_byte: node.end_byte,
            children_ids: Vec::new(), // AstNode doesn't track children_ids
            parent_id: None,          // AstNode doesn't track parent_id
            language: ast_result.language.clone(),
            complexity: 0, // Will be calculated by annotation engine
        })
        .collect();

    // Generate annotations for significant nodes (functions, classes, etc.)
    let significant_types = [
        "function_declaration",
        "function_expression",
        "arrow_function",
        "method_definition",
        "class_declaration",
        "interface_declaration",
        "variable_declaration",
        "export_statement",
        "import_statement",
    ];

    let mut annotations = Vec::new();
    for node in &ast_nodes {
        if significant_types.contains(&node.node_type.as_str()) {
            match engine.annotate_node(node, &language_str, &source_code, &file_path) {
                Ok(annotation) => annotations.push(annotation),
                Err(e) => {
                    if verbose {
                        eprintln!("Failed to annotate node {}: {}", node.id, e);
                    }
                }
            }
        }
    }

    let annotation_summary = format!(
        "File: {}\nLanguage: {}\nTotal nodes: {}\nAnnotations: {}\nProcessing time: {}ms",
        file_path,
        ast_result.language,
        ast_result.total_nodes,
        annotations.len(),
        ast_result.processing_time_ms
    );

    let result = serde_json::json!({
        "file_path": file_path,
        "language": ast_result.language,
        "total_nodes": ast_result.total_nodes,
        "annotations": annotations,
        "processing_time_ms": ast_result.processing_time_ms,
        "summary": annotation_summary
    });

    match format {
        "yaml" => {
            println!("{}", serde_yaml::to_string(&result)?);
        }
        "summary" => {
            println!("{}", annotation_summary);
        }
        _ => {
            output_json(CliResponse::success(result))?;
        }
    }

    Ok(())
}

async fn handle_complexity(
    _parser: &RustParser,
    file: Option<PathBuf>,
    _language: Option<String>,
    stdin: bool,
    format: &str,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (source_code, file_path) = get_source_input(file, stdin)?;

    if verbose {
        eprintln!("Analyzing complexity for: {}", file_path);
    }

    // For now, provide a simple text-based complexity analysis
    let analyzer = ComplexityAnalyzer::new();

    // Create a dummy ASTNode to work with the text-based approach
    let dummy_node = ASTNode {
        id: "root".to_string(),
        node_type: "program".to_string(),
        start_byte: 0,
        end_byte: source_code.len() as u32,
        start_point: Point { row: 0, column: 0 },
        end_point: Point {
            row: source_code.lines().count() as u32,
            column: 0,
        },
        text: source_code.clone(),
        language: "unknown".to_string(),
        complexity: 1,
        parent_id: None,
        children_ids: vec![],
    };

    let metrics = analyzer.analyze_node(&dummy_node, &source_code);

    match format {
        "yaml" => {
            println!("{}", serde_yaml::to_string(&metrics)?);
        }
        "json" => {
            output_json(CliResponse::success(metrics))?;
        }
        _ => {
            println!("Complexity Analysis for: {}", file_path);
            println!("Cyclomatic complexity: {}", metrics.cyclomatic);
            println!("Cognitive complexity: {}", metrics.cognitive);
            println!("Max nesting depth: {}", metrics.max_nesting);
            println!("Decision points: {}", metrics.decision_points);
            println!("Category: {:?}", metrics.category);
            if !metrics.breakdown.is_empty() {
                println!("\nComplexity breakdown:");
                for (decision_type, count) in &metrics.breakdown {
                    println!("  {}: {}", decision_type, count);
                }
            }
        }
    }

    Ok(())
}

async fn handle_dependencies(
    _parser: &RustParser,
    file: Option<PathBuf>,
    _language: Option<String>,
    stdin: bool,
    format: &str,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (source_code, file_path) = get_source_input(file, stdin)?;

    if verbose {
        eprintln!("Analyzing dependencies for: {}", file_path);
    }

    // Create a dummy ASTNode to work with the text-based approach
    let dummy_node = ASTNode {
        id: "root".to_string(),
        node_type: "program".to_string(),
        start_byte: 0,
        end_byte: source_code.len() as u32,
        start_point: Point { row: 0, column: 0 },
        end_point: Point {
            row: source_code.lines().count() as u32,
            column: 0,
        },
        text: source_code.clone(),
        language: "unknown".to_string(),
        complexity: 1,
        parent_id: None,
        children_ids: vec![],
    };

    // Analyze dependencies
    let analyzer = DependencyAnalyzer::new();
    let deps = analyzer.analyze_node(&dummy_node, &source_code, &file_path);

    match format {
        "yaml" => {
            println!("{}", serde_yaml::to_string(&deps)?);
        }
        "json" => {
            output_json(CliResponse::success(deps))?;
        }
        _ => {
            println!("Dependency Analysis for: {}", file_path);
            println!("Imports: {:?}", deps.imports);
            println!("Exports: {:?}", deps.exports);
            if !deps.external_dependencies.is_empty() {
                println!("External dependencies: {:?}", deps.external_dependencies);
            }
            if !deps.calls.is_empty() {
                println!("Function calls: {:?}", deps.calls);
            }
            if !deps.internal_dependencies.is_empty() {
                println!("Internal dependencies: {:?}", deps.internal_dependencies);
            }
        }
    }

    Ok(())
}

fn get_source_input(
    file: Option<PathBuf>,
    stdin: bool,
) -> Result<(String, String), Box<dyn std::error::Error>> {
    if stdin {
        let mut input = String::new();
        let stdin = io::stdin();
        for line in stdin.lock().lines() {
            input.push_str(&line?);
            input.push('\n');
        }
        Ok((input, "<stdin>".to_string()))
    } else {
        let file_path = file.ok_or("File path required when not using stdin")?;
        let source_code = fs::read_to_string(&file_path)?;
        Ok((source_code, file_path.to_string_lossy().to_string()))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    // Initialize parser
    let parser = RustParser::new(cli.max_parsers);

    if cli.verbose {
        eprintln!(
            "Initialized AST parser with {} parsers per language",
            cli.max_parsers
        );
    }

    match cli.command {
        Commands::Parse {
            file,
            language,
            stdin,
        } => {
            handle_parse(&parser, file, language, stdin, cli.verbose).await?;
        }

        Commands::Batch {
            request_file,
            stdin,
        } => {
            handle_batch(&parser, request_file, stdin, cli.verbose).await?;
        }

        Commands::Languages => {
            let languages = RustParser::supported_languages();
            let extensions = RustParser::supported_extensions();

            let data = serde_json::json!({
                "languages": languages,
                "extensions": extensions
            });

            output_json(CliResponse::success(data))?;
        }

        Commands::CheckLanguage { language } => {
            let lang = string_to_language(&language);
            let supported = lang
                .map(|l| RustParser::is_language_supported(&l))
                .unwrap_or(false);

            let data = serde_json::json!({
                "language": language,
                "supported": supported
            });

            output_json(CliResponse::success(data))?;
        }

        Commands::Stats => {
            let stats = parser.get_stats();
            output_json(CliResponse::success(stats))?;
        }

        Commands::Annotate {
            file,
            language,
            stdin,
            format,
        } => {
            handle_annotate(&parser, file, language, stdin, &format, cli.verbose).await?;
        }

        Commands::AnalyzeComplexity {
            file,
            language,
            stdin,
            format,
        } => {
            handle_complexity(&parser, file, language, stdin, &format, cli.verbose).await?;
        }

        Commands::AnalyzeDependencies {
            file,
            language,
            stdin,
            format,
        } => {
            handle_dependencies(&parser, file, language, stdin, &format, cli.verbose).await?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_to_language() {
        assert_eq!(
            string_to_language("javascript"),
            Some(SupportedLanguage::JavaScript)
        );
        assert_eq!(
            string_to_language("js"),
            Some(SupportedLanguage::JavaScript)
        );
        assert_eq!(
            string_to_language("TypeScript"),
            Some(SupportedLanguage::TypeScript)
        );
        assert_eq!(string_to_language("unknown"), None);
    }

    #[tokio::test]
    async fn test_cli_parse_simple() {
        let parser = RustParser::new(2);
        let request = ParseRequest {
            source_code: "const x = 42;".to_string(),
            file_path: "test.js".to_string(),
            language: Some(SupportedLanguage::JavaScript),
        };

        let result = parser.parse(request);
        assert!(result.is_ok());
    }
}
