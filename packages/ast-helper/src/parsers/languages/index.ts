/**
 * Extended Language Support - Issue #150 Component 6/6
 *
 * Provides comprehensive language support for 50+ programming languages
 * with plugin architecture and advanced parsing capabilities.
 *
 * @since 2.0.0
 */

export { ExtendedLanguageManager } from "./extended-language-manager";

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
} from "./types";
