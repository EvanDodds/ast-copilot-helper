/**
 * Default configuration values for AST Copilot Helper
 * These serve as the final fallback when no other configuration is provided
 */

import { Config, PartialConfig } from '../types.js';

export const DEFAULT_CONFIG: Config = {
  parseGlob: [
    'src/**/*.ts',
    'src/**/*.js', 
    'src/**/*.py'
  ],
  watchGlob: [
    'src/**/*'
  ],
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
  batchSize: 100
};

/**
 * Validate configuration values and provide defaults for missing values
 */
export function validateConfig(config: PartialConfig): Config {
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
  
  // Validate boolean values
  if (config.enableTelemetry !== undefined) {
    result.enableTelemetry = Boolean(config.enableTelemetry);
  }
  
  return result;
}
