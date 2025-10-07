use crate::ast_processor::SupportedLanguage;
use crate::error::EngineError;
#[cfg(feature = "full-system")]
use tree_sitter::{Language, Parser};

// Import Tree-sitter language parsers using proper Rust bindings
#[cfg(feature = "full-system")]
use tree_sitter_c;
#[cfg(feature = "full-system")]
use tree_sitter_c_sharp;
#[cfg(feature = "full-system")]
use tree_sitter_cpp;
#[cfg(feature = "full-system")]
use tree_sitter_go;
#[cfg(feature = "full-system")]
use tree_sitter_java;
#[cfg(feature = "full-system")]
use tree_sitter_javascript;
#[cfg(feature = "full-system")]
use tree_sitter_python;
#[cfg(feature = "full-system")]
use tree_sitter_rust;
#[cfg(feature = "full-system")]
use tree_sitter_typescript;

/// Language configuration for Tree-sitter parsers
#[cfg(feature = "full-system")]
pub struct LanguageConfig {
    pub language: SupportedLanguage,
    pub grammar: Language,
    pub extensions: Vec<&'static str>,
}

#[cfg(feature = "full-system")]
impl LanguageConfig {
    /// Get all configured languages with their Tree-sitter grammars
    pub fn get_all_languages() -> Vec<LanguageConfig> {
        vec![
            LanguageConfig {
                language: SupportedLanguage::JavaScript,
                grammar: tree_sitter_javascript::language(),
                extensions: vec!["js", "jsx", "mjs", "cjs"],
            },
            LanguageConfig {
                language: SupportedLanguage::TypeScript,
                grammar: tree_sitter_typescript::language_typescript(),
                extensions: vec!["ts", "tsx"],
            },
            LanguageConfig {
                language: SupportedLanguage::Python,
                grammar: tree_sitter_python::language(),
                extensions: vec!["py", "pyx", "pyi"],
            },
            LanguageConfig {
                language: SupportedLanguage::Rust,
                grammar: tree_sitter_rust::language(),
                extensions: vec!["rs"],
            },
            LanguageConfig {
                language: SupportedLanguage::Java,
                grammar: tree_sitter_java::language(),
                extensions: vec!["java"],
            },
            LanguageConfig {
                language: SupportedLanguage::Cpp,
                grammar: tree_sitter_cpp::language(),
                extensions: vec!["cpp", "cc", "cxx", "c++", "hpp", "hh", "hxx", "h++"],
            },
            LanguageConfig {
                language: SupportedLanguage::C,
                grammar: tree_sitter_c::language(),
                extensions: vec!["c", "h"],
            },
            LanguageConfig {
                language: SupportedLanguage::CSharp,
                grammar: tree_sitter_c_sharp::language(),
                extensions: vec!["cs"],
            },
            LanguageConfig {
                language: SupportedLanguage::Go,
                grammar: tree_sitter_go::language(),
                extensions: vec!["go"],
            },
        ]
    }

    /// Get language configuration by supported language enum
    pub fn get_language_config(language: &SupportedLanguage) -> Option<LanguageConfig> {
        Self::get_all_languages()
            .into_iter()
            .find(|config| config.language == *language)
    }

    /// Detect language from file extension
    pub fn detect_language_from_extension(extension: &str) -> Option<SupportedLanguage> {
        for config in Self::get_all_languages() {
            if config
                .extensions
                .contains(&extension.to_lowercase().as_str())
            {
                return Some(config.language);
            }
        }
        None
    }

    /// Configure a Tree-sitter parser for the specified language
    pub fn configure_parser(
        parser: &mut Parser,
        language: &SupportedLanguage,
    ) -> Result<(), EngineError> {
        if let Some(config) = Self::get_language_config(language) {
            parser.set_language(config.grammar).map_err(|e| {
                EngineError::ASTProcessing(crate::error::ASTProcessingError::TreeSitter(format!(
                    "Failed to set language for {:?}: {}",
                    language, e
                )))
            })?;
            Ok(())
        } else {
            Err(EngineError::ASTProcessing(
                crate::error::ASTProcessingError::TreeSitter(format!(
                    "Unsupported language: {:?}",
                    language
                )),
            ))
        }
    }
}

/// Enhanced supported languages with additional metadata
impl SupportedLanguage {
    /// Get all supported languages
    pub fn all() -> Vec<SupportedLanguage> {
        vec![
            SupportedLanguage::JavaScript,
            SupportedLanguage::TypeScript,
            SupportedLanguage::Python,
            SupportedLanguage::Rust,
            SupportedLanguage::Java,
            SupportedLanguage::Cpp,
            SupportedLanguage::C,
            SupportedLanguage::CSharp,
            SupportedLanguage::Go,
        ]
    }

    /// Get language name as string
    pub fn as_str(&self) -> &'static str {
        match self {
            SupportedLanguage::JavaScript => "javascript",
            SupportedLanguage::TypeScript => "typescript",
            SupportedLanguage::Python => "python",
            SupportedLanguage::Rust => "rust",
            SupportedLanguage::Java => "java",
            SupportedLanguage::Cpp => "cpp",
            SupportedLanguage::C => "c",
            SupportedLanguage::CSharp => "c_sharp",
            SupportedLanguage::Go => "go",
        }
    }

    /// Get typical file extensions for this language
    pub fn extensions(&self) -> Vec<&'static str> {
        match self {
            SupportedLanguage::JavaScript => vec!["js", "jsx", "mjs", "cjs"],
            SupportedLanguage::TypeScript => vec!["ts", "tsx"],
            SupportedLanguage::Python => vec!["py", "pyx", "pyi"],
            SupportedLanguage::Rust => vec!["rs"],
            SupportedLanguage::Java => vec!["java"],
            SupportedLanguage::Cpp => vec!["cpp", "cc", "cxx", "c++", "hpp", "hh", "hxx", "h++"],
            SupportedLanguage::C => vec!["c", "h"],
            SupportedLanguage::CSharp => vec!["cs"],
            SupportedLanguage::Go => vec!["go"],
        }
    }
}

#[cfg(not(feature = "full-system"))]
pub struct LanguageConfig;

#[cfg(not(feature = "full-system"))]
impl LanguageConfig {
    pub fn detect_language_from_extension(extension: &str) -> Option<SupportedLanguage> {
        // WASM fallback - basic extension detection
        match extension.to_lowercase().as_str() {
            "js" | "jsx" | "mjs" | "cjs" => Some(SupportedLanguage::JavaScript),
            "ts" | "tsx" => Some(SupportedLanguage::TypeScript),
            "py" | "pyx" | "pyi" => Some(SupportedLanguage::Python),
            "rs" => Some(SupportedLanguage::Rust),
            "java" => Some(SupportedLanguage::Java),
            "cpp" | "cc" | "cxx" | "c++" | "hpp" | "hh" | "hxx" | "h++" => {
                Some(SupportedLanguage::Cpp)
            }
            "c" | "h" => Some(SupportedLanguage::C),
            "cs" => Some(SupportedLanguage::CSharp),
            "go" => Some(SupportedLanguage::Go),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_extensions() {
        assert_eq!(
            SupportedLanguage::JavaScript.extensions(),
            vec!["js", "jsx", "mjs", "cjs"]
        );
        assert_eq!(
            SupportedLanguage::TypeScript.extensions(),
            vec!["ts", "tsx"]
        );
        assert_eq!(
            SupportedLanguage::Python.extensions(),
            vec!["py", "pyx", "pyi"]
        );
        assert_eq!(SupportedLanguage::Rust.extensions(), vec!["rs"]);
        assert_eq!(SupportedLanguage::Java.extensions(), vec!["java"]);
        assert_eq!(
            SupportedLanguage::Cpp.extensions(),
            vec!["cpp", "cc", "cxx", "c++", "hpp", "hh", "hxx", "h++"]
        );
        assert_eq!(SupportedLanguage::C.extensions(), vec!["c", "h"]);
        assert_eq!(SupportedLanguage::CSharp.extensions(), vec!["cs"]);
        assert_eq!(SupportedLanguage::Go.extensions(), vec!["go"]);
    }

    #[test]
    fn test_language_as_str() {
        assert_eq!(SupportedLanguage::JavaScript.as_str(), "javascript");
        assert_eq!(SupportedLanguage::TypeScript.as_str(), "typescript");
        assert_eq!(SupportedLanguage::Python.as_str(), "python");
        assert_eq!(SupportedLanguage::Rust.as_str(), "rust");
        assert_eq!(SupportedLanguage::Java.as_str(), "java");
        assert_eq!(SupportedLanguage::Cpp.as_str(), "cpp");
        assert_eq!(SupportedLanguage::C.as_str(), "c");
        assert_eq!(SupportedLanguage::CSharp.as_str(), "c_sharp");
        assert_eq!(SupportedLanguage::Go.as_str(), "go");
    }

    #[test]
    fn test_detect_language_from_extension() {
        assert_eq!(
            LanguageConfig::detect_language_from_extension("js"),
            Some(SupportedLanguage::JavaScript)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("ts"),
            Some(SupportedLanguage::TypeScript)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("py"),
            Some(SupportedLanguage::Python)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("rs"),
            Some(SupportedLanguage::Rust)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("java"),
            Some(SupportedLanguage::Java)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("cpp"),
            Some(SupportedLanguage::Cpp)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("c"),
            Some(SupportedLanguage::C)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("cs"),
            Some(SupportedLanguage::CSharp)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("go"),
            Some(SupportedLanguage::Go)
        );
        assert_eq!(
            LanguageConfig::detect_language_from_extension("unknown"),
            None
        );
    }

    #[test]
    fn test_all_languages() {
        let languages = SupportedLanguage::all();
        assert_eq!(languages.len(), 9);
        assert!(languages.contains(&SupportedLanguage::JavaScript));
        assert!(languages.contains(&SupportedLanguage::TypeScript));
        assert!(languages.contains(&SupportedLanguage::Python));
        assert!(languages.contains(&SupportedLanguage::Rust));
        assert!(languages.contains(&SupportedLanguage::Java));
        assert!(languages.contains(&SupportedLanguage::Cpp));
        assert!(languages.contains(&SupportedLanguage::C));
        assert!(languages.contains(&SupportedLanguage::CSharp));
        assert!(languages.contains(&SupportedLanguage::Go));
    }
}
