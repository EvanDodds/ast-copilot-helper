/**
 * Default configuration values for AST Copilot Helper
 * These serve as the final fallback when no other configuration is provided
 * Now includes enhanced validation with detailed error reporting
 */

import type { Config, PartialConfig } from '../types.js';
import { validateConfigStrict, type ValidationResult, defaultValidator } from './enhanced-validator.js';

export const DEFAULT_CONFIG: Config = {
  parseGlob: [
    'src/**/*.ts',
    'src/**/*.js', 
    'src/**/*.py'
  ],
  watchGlob: [
    'src/**/*'
  ],
  fileWatching: {
    watchPaths: ['src', 'lib'],
    includePatterns: ['**/*.ts', '**/*.js', '**/*.py'],
    excludePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.astdb/**'],
    debounceMs: 100,
    batchSize: 50,
    enableRecursive: true,
    followSymlinks: false
  },
  outputDir: '.astdb',
  topK: 5,
  snippetLines: 10,
  indexParams: {
    efConstruction: 200,
    M: 16
  },
  modelHost: 'https://huggingface.co',
  model: {
    defaultModel: 'all-minilm-l6-v2',
    modelsDir: '.astdb/models',
    downloadTimeout: 300000, // 5 minutes
    maxConcurrentDownloads: 2,
    showProgress: true
  },
  enableTelemetry: false,
  concurrency: 4,
  batchSize: 100,
  embeddings: {
    model: 'codebert-base',
    modelPath: '.astdb/models/codebert-base',
    batchSize: 32,
    maxConcurrency: 2,
    memoryLimit: 2048,
    showProgress: true,
    enableConfidenceScoring: true,
    textProcessing: {
      maxTokenLength: 2048,
      preserveCodeStructure: true,
      normalizeWhitespace: true,
      preserveComments: false,
      maxSnippetLength: 500,
    }
  }
};

/**
 * Enhanced configuration validation with detailed error reporting
 * Validates configuration using comprehensive schema and provides cleaned results
 * 
 * @param config - Partial configuration to validate and merge with defaults
 * @returns Complete validated configuration with defaults applied
 * @throws Error with detailed validation report if invalid
 */
export function validateConfig(config: PartialConfig): Config {
  // First validate the input configuration with detailed reporting
  const validatedConfig = validateConfigStrict(config);
  
  // Deep merge with defaults to create complete configuration
  const result: Config = { ...DEFAULT_CONFIG };
  
  // Apply validated configuration values with proper merging for nested objects
  for (const [key, value] of Object.entries(validatedConfig)) {
    if (key === 'fileWatching' && value && typeof value === 'object' && !Array.isArray(value)) {
      // Deep merge fileWatching configuration
      result.fileWatching = {
        ...DEFAULT_CONFIG.fileWatching!,
        ...(value as any)
      };
    } else if (key === 'indexParams' && value && typeof value === 'object' && !Array.isArray(value)) {
      // Deep merge indexParams configuration
      result.indexParams = {
        ...DEFAULT_CONFIG.indexParams,
        ...(value as any)
      };
    } else if (key === 'model' && value && typeof value === 'object' && !Array.isArray(value)) {
      // Deep merge model configuration
      result.model = {
        ...DEFAULT_CONFIG.model,
        ...(value as any)
      };
    } else if (key === 'embeddings' && value && typeof value === 'object' && !Array.isArray(value)) {
      // Deep merge embeddings configuration
      result.embeddings = {
        ...DEFAULT_CONFIG.embeddings,
        ...(value as any)
      };
    } else {
      // Direct assignment for primitive values and arrays
      (result as any)[key] = value;
    }
  }
  
  return result;
}

/**
 * Validate configuration with detailed result reporting (non-throwing version)
 * 
 * @param config - Configuration object to validate
 * @returns Detailed validation result with errors, warnings, and cleaned config
 */
export function validateConfigDetailed(config: PartialConfig): ValidationResult {
  return defaultValidator.validate(config);
}

/**
 * Legacy validation function with basic error messages
 * Kept for backward compatibility - prefer validateConfig() for new code
 */
export function validateConfigLegacy(config: PartialConfig): Config {
  const result: Config = { ...DEFAULT_CONFIG };
  
  // Validate and set parseGlob
  if (config.parseGlob) {
    if (!Array.isArray(config.parseGlob)) {
      throw new Error('parseGlob must be an array of strings');
    }
    result.parseGlob = config.parseGlob.filter(pattern => typeof pattern === 'string');
  }
  
  // Validate and set watchGlob
  if (config.watchGlob) {
    if (!Array.isArray(config.watchGlob)) {
      throw new Error('watchGlob must be an array of strings');
    }
    result.watchGlob = config.watchGlob.filter(pattern => typeof pattern === 'string');
  }
  
  // Validate numeric values
  if (config.topK !== undefined) {
    const topK = Number(config.topK);
    if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
      throw new Error('topK must be an integer between 1 and 100');
    }
    result.topK = topK;
  }
  
  if (config.snippetLines !== undefined) {
    const snippetLines = Number(config.snippetLines);
    if (!Number.isInteger(snippetLines) || snippetLines < 1 || snippetLines > 50) {
      throw new Error('snippetLines must be an integer between 1 and 50');
    }
    result.snippetLines = snippetLines;
  }
  
  if (config.concurrency !== undefined) {
    const concurrency = Number(config.concurrency);
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
      throw new Error('concurrency must be an integer between 1 and 16');
    }
    result.concurrency = concurrency;
  }
  
  if (config.batchSize !== undefined) {
    const batchSize = Number(config.batchSize);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
      throw new Error('batchSize must be an integer between 1 and 1000');
    }
    result.batchSize = batchSize;
  }
  
  // Validate index parameters
  if (config.indexParams) {
    const { efConstruction, M } = config.indexParams;
    
    if (efConstruction !== undefined) {
      const ef = Number(efConstruction);
      if (!Number.isInteger(ef) || ef < 16 || ef > 800) {
        throw new Error('efConstruction must be an integer between 16 and 800');
      }
      result.indexParams.efConstruction = ef;
    }
    
    if (M !== undefined) {
      const m = Number(M);
      if (!Number.isInteger(m) || m < 4 || m > 64) {
        throw new Error('M must be an integer between 4 and 64');
      }
      result.indexParams.M = m;
    }
  }
  
  // Validate string values
  if (config.modelHost !== undefined) {
    if (typeof config.modelHost !== 'string' || config.modelHost.trim().length === 0) {
      throw new Error('modelHost must be a non-empty string');
    }
    result.modelHost = config.modelHost.trim();
  }
  
  // Validate file watching configuration
  if (config.fileWatching) {
    const watchConfig = config.fileWatching;
    
    // Validate watchPaths
    if (watchConfig.watchPaths !== undefined) {
      if (!Array.isArray(watchConfig.watchPaths)) {
        throw new Error('fileWatching.watchPaths must be an array of strings');
      }
      const validPaths = watchConfig.watchPaths.filter(path => 
        typeof path === 'string' && path.trim().length > 0
      );
      if (validPaths.length === 0) {
        throw new Error('fileWatching.watchPaths must contain at least one valid path');
      }
      result.fileWatching!.watchPaths = validPaths;
    }
    
    // Validate includePatterns
    if (watchConfig.includePatterns !== undefined) {
      if (!Array.isArray(watchConfig.includePatterns)) {
        throw new Error('fileWatching.includePatterns must be an array of strings');
      }
      result.fileWatching!.includePatterns = watchConfig.includePatterns.filter(
        pattern => typeof pattern === 'string' && pattern.trim().length > 0
      );
    }
    
    // Validate excludePatterns
    if (watchConfig.excludePatterns !== undefined) {
      if (!Array.isArray(watchConfig.excludePatterns)) {
        throw new Error('fileWatching.excludePatterns must be an array of strings');
      }
      result.fileWatching!.excludePatterns = watchConfig.excludePatterns.filter(
        pattern => typeof pattern === 'string' && pattern.trim().length > 0
      );
    }
    
    // Validate debounceMs
    if (watchConfig.debounceMs !== undefined) {
      const debounce = Number(watchConfig.debounceMs);
      if (!Number.isInteger(debounce) || debounce < 0 || debounce > 5000) {
        throw new Error('fileWatching.debounceMs must be an integer between 0 and 5000');
      }
      result.fileWatching!.debounceMs = debounce;
    }
    
    // Validate batchSize
    if (watchConfig.batchSize !== undefined) {
      const batchSize = Number(watchConfig.batchSize);
      if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
        throw new Error('fileWatching.batchSize must be an integer between 1 and 1000');
      }
      result.fileWatching!.batchSize = batchSize;
    }
    
    // Validate boolean flags
    if (watchConfig.enableRecursive !== undefined) {
      result.fileWatching!.enableRecursive = Boolean(watchConfig.enableRecursive);
    }
    
    if (watchConfig.followSymlinks !== undefined) {
      result.fileWatching!.followSymlinks = Boolean(watchConfig.followSymlinks);
    }
  }
  
  // Validate boolean values
  if (config.enableTelemetry !== undefined) {
    result.enableTelemetry = Boolean(config.enableTelemetry);
  }
  
  return result;
}
