/**
 * Parsers Module - AST Copilot Helper
 *
 * Provides comprehensive language parsing capabilities with extended language support.
 *
 * This module includes the Extended Language Support component from Issue #150,
 * providing support for 50+ programming languages through a plugin architecture.
 *
 * @since 2.0.0
 */

// Extended Language Support (Issue #150 Component 6/6)
export { ExtendedLanguageManager } from "./languages";

export type {
  // Core Types
  ExtendedLanguage,
  AllSupportedLanguages,
  LanguageGrammar,
  LanguagePlugin,

  // Configuration
  ExtendedLanguageConfig,
  LanguageParsingOptions,

  // Plugin System
  PluginContext,
  PluginFileSystem,
  PluginCache,
  PluginEventEmitter,
  PluginLogger,

  // Registry
  LanguageRegistryEntry,

  // Results
  ValidationResult,
  ParseError,

  // Language Metadata
  LanguageMetadata,
  LanguageCategory,
  LanguageParadigm,
  MaintainerInfo,
  DocumentationLinks,
  CommunityResources,

  // Processing
  ErrorRecoveryStrategy,
  PreProcessor,
  PostProcessor,
  HighlightingConfig,
  HighlightRule,

  // Validation
  ValidationConfig,
  ValidationRule,
  BuiltInValidator,
  AutoFix,
  ExternalLinter,
  SeverityLevel,

  // Features
  LanguageFeatures,
} from "./languages";
