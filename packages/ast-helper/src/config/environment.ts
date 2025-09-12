/**
 * Environment variable configuration parsing
 * Maps AST_COPILOT_* environment variables to configuration options
 */

import { PartialConfig, EnvConfig } from '../types.js';

/**
 * Parse environment variables into partial configuration
 */
export function parseEnvironmentConfig(): PartialConfig {
  const env = process.env as EnvConfig;
  const config: PartialConfig = {};
  
  // Parse numeric values
  if (env.AST_COPILOT_TOP_K) {
    const value = parseInt(env.AST_COPILOT_TOP_K, 10);
    if (!isNaN(value)) {
      config.topK = value;
    }
  }
  
  if (env.AST_COPILOT_SNIPPET_LINES) {
    const value = parseInt(env.AST_COPILOT_SNIPPET_LINES, 10);
    if (!isNaN(value)) {
      config.snippetLines = value;
    }
  }
  
  if (env.AST_COPILOT_CONCURRENCY) {
    const value = parseInt(env.AST_COPILOT_CONCURRENCY, 10);
    if (!isNaN(value)) {
      config.concurrency = value;
    }
  }
  
  if (env.AST_COPILOT_BATCH_SIZE) {
    const value = parseInt(env.AST_COPILOT_BATCH_SIZE, 10);
    if (!isNaN(value)) {
      config.batchSize = value;
    }
  }
  
  // Parse index parameters
  if (env.AST_COPILOT_EF_CONSTRUCTION || env.AST_COPILOT_M) {
    config.indexParams = {};
    
    if (env.AST_COPILOT_EF_CONSTRUCTION) {
      const value = parseInt(env.AST_COPILOT_EF_CONSTRUCTION, 10);
      if (!isNaN(value)) {
        config.indexParams.efConstruction = value;
      }
    }
    
    if (env.AST_COPILOT_M) {
      const value = parseInt(env.AST_COPILOT_M, 10);
      if (!isNaN(value)) {
        config.indexParams.M = value;
      }
    }
  }
  
  // Parse string values
  if (env.AST_COPILOT_MODEL_HOST) {
    config.modelHost = env.AST_COPILOT_MODEL_HOST;
  }
  
  if (env.AST_COPILOT_OUTPUT_DIR) {
    config.outputDir = env.AST_COPILOT_OUTPUT_DIR;
  }
  
  // Parse boolean values
  if (env.AST_COPILOT_ENABLE_TELEMETRY) {
    const value = env.AST_COPILOT_ENABLE_TELEMETRY.toLowerCase();
    config.enableTelemetry = value === 'true' || value === '1' || value === 'yes';
  }

  if (env.AST_COPILOT_VERBOSE) {
    const value = env.AST_COPILOT_VERBOSE.toLowerCase();
    config.verbose = value === 'true' || value === '1' || value === 'yes';
  }

  if (env.AST_COPILOT_DEBUG) {
    const value = env.AST_COPILOT_DEBUG.toLowerCase();
    config.debug = value === 'true' || value === '1' || value === 'yes';
  }

  if (env.AST_COPILOT_JSON_LOGS) {
    const value = env.AST_COPILOT_JSON_LOGS.toLowerCase();
    config.jsonLogs = value === 'true' || value === '1' || value === 'yes';
  }

  if (env.AST_COPILOT_LOG_FILE) {
    config.logFile = env.AST_COPILOT_LOG_FILE;
  }
  
  // Parse glob arrays (comma-separated)
  if (env.AST_COPILOT_PARSE_GLOB) {
    config.parseGlob = env.AST_COPILOT_PARSE_GLOB
      .split(',')
      .map(pattern => pattern.trim())
      .filter(pattern => pattern.length > 0);
  }
  
  if (env.AST_COPILOT_WATCH_GLOB) {
    config.watchGlob = env.AST_COPILOT_WATCH_GLOB
      .split(',')
      .map(pattern => pattern.trim())
      .filter(pattern => pattern.length > 0);
  }
  
  return config;
}
