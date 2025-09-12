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
  
  /** Usage analytics enabled */
  enableTelemetry: boolean;
  
  /** Parallel processing limit */
  concurrency: number;
  
  /** Batch processing size */
  batchSize: number;
}

/**
 * Partial configuration type for merging sources
 */
export type PartialConfig = Partial<{
  parseGlob: string[];
  watchGlob: string[];
  topK: number;
  snippetLines: number;
  indexParams: Partial<{
    efConstruction: number;
    M: number;
  }>;
  modelHost: string;
  enableTelemetry: boolean;
  concurrency: number;
  batchSize: number;
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
}

/**
 * Environment variables mapping
 */
export interface EnvConfig {
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
}

// Legacy interface for backward compatibility
export interface AstHelperConfig {
  initialized: boolean;
}
