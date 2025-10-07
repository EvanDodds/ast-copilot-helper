//! AST Parser CLI
//!
//! Command-line interface for the Rust AST parser engine.
//! This binary provides fast parsing capabilities for TypeScript CLI integration.

use ast_helper_core_engine::{
    ast_processor::SupportedLanguage,
    parse_interface::{BatchParseRequest, ParseRequest, RustParser},
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
