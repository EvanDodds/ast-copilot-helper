/**
 * Shared types for ast-helper package
 * Core configuration and type definitions for AST processing
 */

/**
 * Core configuration interface for AST Copilot Helper
 * Configuration values are resolved in priority order: CLI > env > project > user > defaults
 */
export interface Config {
  /** File patterns to parse */
  parseGlob: string[];
  
  /** File patterns to watch */
  watchGlob: string[];
  
  /** Output directory for database files */
  outputDir: string;
  
  /** Number of results to return */
  topK: number;
  
  /** Lines of code context */
  snippetLines: number;
  
  /** HNSW index parameters */
  indexParams: {
    /** Build quality (16-800) */
    efConstruction: number;
    /** Connectivity (4-64) */
    M: number;
  };
  
  /** Model download URL */
  modelHost: string;
  
  /** Model configuration */
  model: {
    /** Default model name to use */
    defaultModel: string;
    /** Models directory path */
    modelsDir: string;
    /** Download timeout in milliseconds */
    downloadTimeout: number;
    /** Maximum concurrent downloads */
    maxConcurrentDownloads: number;
    /** Enable download progress reporting */
    showProgress: boolean;
  };
  
  /** Usage analytics enabled */
  enableTelemetry: boolean;
  
  /** Parallel processing limit */
  concurrency: number;
  
  /** Batch processing size */
  batchSize: number;
  
  /** CLI-specific logging options */
  verbose?: boolean;
  debug?: boolean;
  jsonLogs?: boolean;
  logFile?: string;
}

/**
 * Partial configuration type for merging sources
 */
export type PartialConfig = Partial<{
  parseGlob: string[];
  watchGlob: string[];
  outputDir: string;
  topK: number;
  snippetLines: number;
  indexParams: Partial<{
    efConstruction: number;
    M: number;
  }>;
  modelHost: string;
  model: Partial<{
    defaultModel: string;
    modelsDir: string;
    downloadTimeout: number;
    maxConcurrentDownloads: number;
    showProgress: boolean;
  }>;
  enableTelemetry: boolean;
  concurrency: number;
  batchSize: number;
  verbose: boolean;
  debug: boolean;
  jsonLogs: boolean;
  logFile: string;
}>;

/**
 * CLI arguments interface
 */
export interface CliArgs {
  config?: string;
  'top-k'?: number;
  'batch-size'?: number;
  'snippet-lines'?: number;
  concurrency?: number;
  'parse-glob'?: string;
  'watch-glob'?: string;
  'model-host'?: string;
  'enable-telemetry'?: boolean;
  'ef-construction'?: number;
  'M'?: number;
  // Additional CLI-specific options
  source?: string;
  outputDir?: string;
  parseGlob?: string[];
  watchGlob?: string[];
  topK?: number;
  watch?: boolean;
  verbose?: boolean;
  debug?: boolean;
  logFile?: string;
  jsonLogs?: boolean;
  help?: boolean;
  version?: boolean;
}

/**
 * Environment variables mapping
 */
export interface EnvConfig {
  AST_COPILOT_OUTPUT_DIR?: string;
  AST_COPILOT_TOP_K?: string;
  AST_COPILOT_SNIPPET_LINES?: string;
  AST_COPILOT_PARSE_GLOB?: string;
  AST_COPILOT_WATCH_GLOB?: string;
  AST_COPILOT_ENABLE_TELEMETRY?: string;
  AST_COPILOT_MODEL_HOST?: string;
  AST_COPILOT_CONCURRENCY?: string;
  AST_COPILOT_BATCH_SIZE?: string;
  AST_COPILOT_EF_CONSTRUCTION?: string;
  AST_COPILOT_M?: string;
  AST_COPILOT_VERBOSE?: string;
  AST_COPILOT_DEBUG?: string;
  AST_COPILOT_JSON_LOGS?: string;
  AST_COPILOT_LOG_FILE?: string;
}

// Legacy interface for backward compatibility
export interface AstHelperConfig {
  initialized: boolean;
}
