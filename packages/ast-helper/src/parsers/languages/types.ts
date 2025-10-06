/**
 * Extended Language Support - Types and Interfaces
 *
 * Defines types and interfaces for extending language support beyond the core set,
 * including custom grammar support and plugin architecture.
 */

import type Parser from "web-tree-sitter";

/**
 * Extended supported languages beyond the core set
 */
export type ExtendedLanguage =
  // Web Technologies
  | "html"
  | "css"
  | "scss"
  | "sass"
  | "less"
  | "vue"
  | "svelte"
  | "jsx"
  | "tsx"

  // Systems Languages
  | "c"
  | "cpp"
  | "zig"
  | "nim"
  | "d"
  | "crystal"

  // Functional Languages
  | "haskell"
  | "ocaml"
  | "elm"
  | "fsharp"
  | "clojure"
  | "racket"
  | "scheme"

  // JVM Languages
  | "kotlin"
  | "scala"
  | "groovy"

  // .NET Languages
  | "csharp"
  | "vb"

  // Mobile Development
  | "swift"
  | "objective-c"
  | "dart"

  // Data & Configuration
  | "toml"
  | "ini"
  | "properties"
  | "dockerfile"
  | "makefile"
  | "cmake"
  | "ninja"

  // Query Languages
  | "sql"
  | "graphql"
  | "sparql"

  // Markup & Documentation
  | "markdown"
  | "rst"
  | "latex"
  | "asciidoc"

  // Scientific Computing
  | "r"
  | "julia"
  | "matlab"
  | "octave"

  // Scripting Languages
  | "lua"
  | "perl"
  | "powershell"
  | "fish"
  | "zsh"
  | "bash"

  // Specialized Languages
  | "solidity"
  | "move"
  | "cairo"
  | "prolog"
  | "erlang"
  | "elixir"
  | "phoenix"

  // Template Languages
  | "jinja2"
  | "handlebars"
  | "mustache"
  | "liquid"

  // Custom/Plugin Languages
  | "custom";

/**
 * All supported languages (core + extended)
 */
export type AllSupportedLanguages = ExtendedLanguage;

/**
 * Language grammar configuration
 */
export interface LanguageGrammar {
  /** Language identifier */
  name: ExtendedLanguage;

  /** Display name for the language */
  displayName: string;

  /** File extensions associated with this language */
  extensions: string[];

  /** Path to the tree-sitter grammar WASM file */
  grammarPath: string;

  /** Alternative grammar paths for fallback */
  fallbackGrammars?: string[];

  /** Language-specific parsing options */
  parsingOptions?: LanguageParsingOptions;

  /** Syntax highlighting configuration */
  highlighting?: HighlightingConfig;

  /** Language features supported */
  features?: LanguageFeatures;

  /** Validation rules for this language */
  validation?: ValidationConfig;

  /** Language metadata */
  metadata?: LanguageMetadata;
}

/**
 * Language-specific parsing options
 */
export interface LanguageParsingOptions {
  /** Maximum file size to parse (in bytes) */
  maxFileSize?: number;

  /** Timeout for parsing operations (in milliseconds) */
  timeout?: number;

  /** Whether to enable incremental parsing */
  incrementalParsing?: boolean;

  /** Memory limit for parsing (in bytes) */
  memoryLimit?: number;

  /** Custom tree-sitter options */
  treeServeOptions?: Record<string, unknown>;

  /** Language-specific error recovery strategies */
  errorRecovery?: ErrorRecoveryStrategy[];

  /** Skip parsing for certain patterns */
  skipPatterns?: RegExp[];

  /** Pre-processing steps before parsing */
  preProcessors?: PreProcessor[];

  /** Post-processing steps after parsing */
  postProcessors?: PostProcessor[];
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  /** Strategy type */
  type: "skip" | "substitute" | "insert" | "delete" | "custom";

  /** Pattern to match for this strategy */
  pattern: RegExp;

  /** Recovery action */
  action: string | ((error: ParseError) => string);

  /** Priority (higher numbers processed first) */
  priority: number;

  /** Whether this strategy should stop further processing */
  terminal?: boolean;
}

/**
 * Pre-processor for code transformation before parsing
 */
export interface PreProcessor {
  /** Processor name */
  name: string;

  /** Processing function */
  process: (code: string, options?: Record<string, unknown>) => Promise<string>;

  /** Whether this processor is required */
  required: boolean;

  /** Processing options */
  options?: Record<string, unknown>;
}

/**
 * Post-processor for AST transformation after parsing
 */
export interface PostProcessor {
  /** Processor name */
  name: string;

  /** Processing function */
  process: (
    ast: unknown,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;

  /** Whether this processor is required */
  required: boolean;

  /** Processing options */
  options?: Record<string, unknown>;
}

/**
 * Syntax highlighting configuration
 */
export interface HighlightingConfig {
  /** Tree-sitter highlight queries */
  queries: string[];

  /** Color scheme mapping */
  colorScheme?: Record<string, string>;

  /** Supported themes */
  themes?: string[];

  /** Custom highlight rules */
  customRules?: HighlightRule[];
}

/**
 * Custom highlight rule
 */
export interface HighlightRule {
  /** Rule name */
  name: string;

  /** Tree-sitter query pattern */
  pattern: string;

  /** Highlight class or color */
  highlight: string;

  /** Rule priority */
  priority: number;

  /** Whether this rule should override defaults */
  override?: boolean;
}

/**
 * Language features supported
 */
export interface LanguageFeatures {
  /** Code completion support */
  completion?: boolean;

  /** Hover information */
  hover?: boolean;

  /** Go to definition */
  definition?: boolean;

  /** Find references */
  references?: boolean;

  /** Symbol search */
  symbols?: boolean;

  /** Code formatting */
  formatting?: boolean;

  /** Syntax validation */
  validation?: boolean;

  /** Refactoring support */
  refactoring?: boolean;

  /** Folding ranges */
  folding?: boolean;

  /** Semantic tokens */
  semanticTokens?: boolean;

  /** Custom features */
  custom?: Record<string, boolean>;
}

/**
 * Language validation configuration
 */
export interface ValidationConfig {
  /** Built-in validators */
  builtIn?: BuiltInValidator[];

  /** Custom validation rules */
  customRules?: ValidationRule[];

  /** External linters integration */
  externalLinters?: ExternalLinter[];

  /** Validation severity levels */
  severityLevels?: SeverityLevel[];
}

/**
 * Built-in validator
 */
export interface BuiltInValidator {
  /** Validator name */
  name: string;

  /** Whether validator is enabled */
  enabled: boolean;

  /** Validator configuration */
  config?: Record<string, unknown>;
}

/**
 * Custom validation rule
 */
export interface ValidationRule {
  /** Rule name */
  name: string;

  /** Rule description */
  description: string;

  /** Tree-sitter query to match violations */
  query: string;

  /** Error message template */
  message: string;

  /** Rule severity */
  severity: "error" | "warning" | "info" | "hint";

  /** Auto-fix suggestion */
  fix?: AutoFix;

  /** Rule tags */
  tags?: string[];
}

/**
 * Auto-fix suggestion
 */
export interface AutoFix {
  /** Fix description */
  description: string;

  /** Fix function */
  apply: (node: unknown, context: unknown) => Promise<string>;

  /** Whether fix is safe to apply automatically */
  safe: boolean;
}

/**
 * External linter integration
 */
export interface ExternalLinter {
  /** Linter name */
  name: string;

  /** Command to run linter */
  command: string;

  /** Command arguments */
  args: string[];

  /** Working directory */
  cwd?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Output parser */
  parser: (output: string) => ValidationResult[];

  /** Whether linter is enabled */
  enabled: boolean;
}

/**
 * Validation severity level
 */
export interface SeverityLevel {
  /** Level name */
  name: string;

  /** Numeric value (higher = more severe) */
  value: number;

  /** Display color */
  color: string;

  /** Whether violations should fail validation */
  failOnViolation: boolean;
}

/**
 * Language metadata
 */
export interface LanguageMetadata {
  /** Official language website */
  website?: string;

  /** Language category */
  category: LanguageCategory;

  /** Language paradigms */
  paradigms: LanguageParadigm[];

  /** Typical use cases */
  useCases: string[];

  /** Language status */
  status: "stable" | "experimental" | "deprecated";

  /** First-class support level */
  supportLevel: "full" | "partial" | "basic" | "community";

  /** Maintainer information */
  maintainer?: MaintainerInfo;

  /** Documentation links */
  documentation?: DocumentationLinks;

  /** Community resources */
  community?: CommunityResources;
}

/**
 * Language category
 */
export type LanguageCategory =
  | "programming"
  | "markup"
  | "stylesheet"
  | "data"
  | "configuration"
  | "query"
  | "template"
  | "documentation"
  | "domain-specific";

/**
 * Language paradigm
 */
export type LanguageParadigm =
  | "imperative"
  | "object-oriented"
  | "functional"
  | "logical"
  | "concurrent"
  | "reactive"
  | "declarative"
  | "procedural"
  | "event-driven"
  | "aspect-oriented";

/**
 * Maintainer information
 */
export interface MaintainerInfo {
  /** Maintainer name */
  name: string;

  /** Contact email */
  email?: string;

  /** GitHub username */
  github?: string;

  /** Organization */
  organization?: string;
}

/**
 * Documentation links
 */
export interface DocumentationLinks {
  /** Official documentation */
  official?: string;

  /** API reference */
  api?: string;

  /** Tutorials */
  tutorials?: string[];

  /** Examples */
  examples?: string[];

  /** Community guides */
  community?: string[];
}

/**
 * Community resources
 */
export interface CommunityResources {
  /** Community forum */
  forum?: string;

  /** Discord/Slack channels */
  chat?: string[];

  /** Stack Overflow tag */
  stackoverflow?: string;

  /** Reddit community */
  reddit?: string;

  /** Awesome list */
  awesome?: string;
}

/**
 * Language plugin interface
 */
export interface LanguagePlugin {
  /** Plugin name */
  name: string;

  /** Plugin version */
  version: string;

  /** Supported languages */
  languages: ExtendedLanguage[];

  /** Plugin initialization */
  initialize(context: PluginContext): Promise<void>;

  /** Get language grammar */
  getGrammar(language: ExtendedLanguage): Promise<LanguageGrammar>;

  /** Create parser instance */
  createParser(language: ExtendedLanguage): Promise<Parser>;

  /** Plugin cleanup */
  dispose(): Promise<void>;

  /** Plugin metadata */
  metadata: PluginMetadata;
}

/**
 * Plugin context
 */
export interface PluginContext {
  /** Plugin configuration */
  config: Record<string, unknown>;

  /** Logging interface */
  logger: PluginLogger;

  /** File system access */
  fs: PluginFileSystem;

  /** Cache interface */
  cache: PluginCache;

  /** Event emitter */
  events: PluginEventEmitter;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Plugin file system interface
 */
export interface PluginFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
}

/**
 * Plugin cache interface
 */
export interface PluginCache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Plugin event emitter interface
 */
export interface PluginEventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Plugin description */
  description: string;

  /** Plugin author */
  author: string;

  /** Plugin license */
  license: string;

  /** Plugin homepage */
  homepage?: string;

  /** Plugin repository */
  repository?: string;

  /** Plugin keywords */
  keywords: string[];

  /** Plugin dependencies */
  dependencies?: Record<string, string>;

  /** Minimum engine version */
  engines?: Record<string, string>;
}

/**
 * Parse error for extended languages
 */
export interface ParseError {
  /** Error type */
  type: "syntax" | "semantic" | "lexical" | "timeout" | "memory" | "plugin";

  /** Error message */
  message: string;

  /** Error location */
  location?: {
    line: number;
    column: number;
    index: number;
    length?: number;
  };

  /** Error severity */
  severity: "error" | "warning" | "info" | "hint";

  /** Error code */
  code?: string;

  /** Recovery suggestions */
  suggestions?: string[];

  /** Related errors */
  related?: ParseError[];

  /** Source language */
  language: ExtendedLanguage;

  /** Plugin that generated this error */
  plugin?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors */
  errors: ParseError[];

  /** Validation warnings */
  warnings: ParseError[];

  /** Performance metrics */
  metrics?: {
    duration: number;
    memoryUsage: number;
    rulesEvaluated: number;
  };

  /** Validation metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  /** Detected language */
  language: ExtendedLanguage;

  /** Detection confidence (0-1) */
  confidence: number;

  /** Detection method used */
  method: "extension" | "content" | "shebang" | "filename" | "heuristic";

  /** Alternative language suggestions */
  alternatives?: Array<{
    language: ExtendedLanguage;
    confidence: number;
  }>;

  /** Detection metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extended parsing result
 */
export interface ExtendedParseResult {
  /** Whether parsing was successful */
  success: boolean;

  /** Parsed AST */
  ast?: unknown;

  /** Parse errors */
  errors?: ParseError[];

  /** Parse warnings */
  warnings?: ParseError[];

  /** Language used for parsing */
  language: ExtendedLanguage;

  /** Plugin used for parsing */
  plugin?: string;

  /** Parse metrics */
  metrics?: {
    parseTime: number;
    nodeCount: number;
    memoryUsage: number;
    cacheHit: boolean;
  };

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Language registry entry
 */
export interface LanguageRegistryEntry {
  /** Language grammar */
  grammar: LanguageGrammar;

  /** Associated plugin */
  plugin?: LanguagePlugin;

  /** Parser instance */
  parser?: Parser;

  /** Registration timestamp */
  registeredAt: Date;

  /** Usage statistics */
  stats: {
    parseCount: number;
    totalParseTime: number;
    errorCount: number;
    lastUsed?: Date;
  };

  /** Whether language is enabled */
  enabled: boolean;
}

/**
 * Extended language manager configuration
 */
export interface ExtendedLanguageConfig {
  /** Base configuration */
  baseConfig: {
    /** Plugin directory */
    pluginDirectory: string;

    /** Grammar cache directory */
    cacheDirectory: string;

    /** Maximum concurrent parsers */
    maxConcurrentParsers: number;

    /** Default timeout for language operations */
    defaultTimeout: number;

    /** Memory limit per parser */
    memoryLimitPerParser: number;
  };

  /** Language-specific configurations */
  languageConfigs: Record<ExtendedLanguage, Partial<LanguageParsingOptions>>;

  /** Plugin configurations */
  pluginConfigs: Record<string, Record<string, unknown>>;

  /** Auto-discovery settings */
  autoDiscovery: {
    /** Whether to auto-discover plugins */
    enabled: boolean;

    /** Directories to search for plugins */
    searchPaths: string[];

    /** Plugin file patterns */
    patterns: string[];

    /** Whether to load plugins automatically */
    autoLoad: boolean;
  };

  /** Validation settings */
  validation: {
    /** Whether to validate grammars on load */
    validateGrammars: boolean;

    /** Whether to validate plugins on load */
    validatePlugins: boolean;

    /** Strict mode settings */
    strictMode: boolean;
  };

  /** Performance settings */
  performance: {
    /** Whether to enable caching */
    enableCaching: boolean;

    /** Cache size limits */
    cacheLimits: {
      grammarCache: number;
      parseCache: number;
      metadataCache: number;
    };

    /** Whether to enable metrics collection */
    enableMetrics: boolean;

    /** Metrics collection interval */
    metricsInterval: number;
  };

  /** Development settings */
  development: {
    /** Whether to enable hot reload for plugins */
    hotReload: boolean;

    /** Whether to enable debug logging */
    debugLogging: boolean;

    /** Development plugin paths */
    devPluginPaths: string[];
  };
}
