/**
 * Comprehensive configuration validation schema and utilities
 * Provides enhanced validation with detailed error messages and suggestions
 */

export interface ValidationRule<T = any> {
  /** Validation function that returns true if valid, string if invalid */
  validate: (value: T) => true | string;
  /** Optional suggestion for fixing the validation error */
  suggestion?: string;
  /** Optional example of valid values */
  example?: T | T[];
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

/**
 * Utility functions for common validation patterns
 */
export class ValidationUtils {
  /**
   * Creates a validator for numeric ranges with helpful error messages
   */
  static numericRange(min: number, max: number, name: string): ValidationRule<any> {
    return {
      validate: (value: any) => {
        const num = Number(value);
        if (isNaN(num)) {
          return `${name} must be a valid number, got: ${typeof value} "${value}"`;
        }
        if (!Number.isInteger(num)) {
          return `${name} must be an integer, got decimal: ${num}`;
        }
        if (num < min || num > max) {
          return `${name} must be between ${min} and ${max}, got: ${num}`;
        }
        return true;
      },
      suggestion: `Use an integer between ${min} and ${max}`,
      example: [min, Math.floor((min + max) / 2), max]
    };
  }

  /**
   * Creates a validator for string arrays with filtering and helpful messages
   */
  static stringArray(name: string, minItems = 0, allowEmpty = false): ValidationRule<any> {
    return {
      validate: (value: any) => {
        if (!Array.isArray(value)) {
          return `${name} must be an array, got: ${typeof value}`;
        }
        
        // Filter valid strings - allow empty strings in input but filter them out
        const validStrings = value.filter(item => 
          typeof item === 'string' && (allowEmpty || item.trim().length > 0)
        );
        
        if (validStrings.length < minItems) {
          const itemsText = minItems === 1 ? 'item' : 'items';
          return `${name} must contain at least ${minItems} valid ${itemsText}, got: ${validStrings.length}`;
        }
        
        // Check for invalid items but don't fail - just warn about them in the cleaning process
        return true;
      },
      suggestion: allowEmpty 
        ? `Use an array of strings (empty strings allowed)`
        : `Use an array of non-empty strings`,
      example: allowEmpty ? ['example', ''] : ['*.ts', '*.js', 'src/**']
    };
  }

  /**
   * Creates a validator for non-empty strings
   */
  static nonEmptyString(name: string): ValidationRule<any> {
    return {
      validate: (value: any) => {
        if (typeof value !== 'string') {
          return `${name} must be a string, got: ${typeof value}`;
        }
        if (value.trim().length === 0) {
          return `${name} cannot be empty`;
        }
        return true;
      },
      suggestion: `Provide a non-empty string value`,
      example: 'example-value'
    };
  }

  /**
   * Creates a validator for directory paths
   */
  static directoryPath(name: string): ValidationRule<any> {
    return {
      validate: (value: any) => {
        if (typeof value !== 'string') {
          return `${name} must be a string path, got: ${typeof value}`;
        }
        if (value.trim().length === 0) {
          return `${name} cannot be empty`;
        }
        // Basic path validation - more comprehensive checks could be added
        const trimmed = value.trim();
        if (trimmed.includes('..') && !trimmed.startsWith('./') && !trimmed.startsWith('../')) {
          return `${name} contains potentially unsafe path traversal: "${trimmed}"`;
        }
        return true;
      },
      suggestion: `Use a valid directory path (relative or absolute)`,
      example: ['./output', '/tmp/ast-helper', 'dist/embeddings']
    };
  }

  /**
   * Creates a validator for URL strings
   */
  static urlString(name: string, allowedProtocols = ['http', 'https']): ValidationRule<any> {
    return {
      validate: (value: any) => {
        if (typeof value !== 'string') {
          return `${name} must be a string URL, got: ${typeof value}`;
        }
        
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return `${name} cannot be empty`;
        }
        
        try {
          const url = new URL(trimmed);
          if (!allowedProtocols.includes(url.protocol.replace(':', ''))) {
            return `${name} must use one of these protocols: ${allowedProtocols.join(', ')}, got: ${url.protocol}`;
          }
          return true;
        } catch (error) {
          return `${name} must be a valid URL, got: "${trimmed}"`;
        }
      },
      suggestion: `Use a valid URL with protocol: ${allowedProtocols.join(', ')}`,
      example: 'https://example.com/models'
    };
  }

  /**
   * Creates a validator for boolean values with type coercion info
   */
  static boolean(name: string): ValidationRule<any> {
    return {
      validate: (value: any) => {
        // Accept boolean values and common string representations
        if (typeof value === 'boolean') {
return true;
}
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
            return true;
          }
        }
        if (typeof value === 'number' && (value === 0 || value === 1)) {
          return true;
        }
        return `${name} must be a boolean value, got: ${typeof value} "${value}"`;
      },
      suggestion: `Use true/false, or string representations: "true"/"false", "yes"/"no", "1"/"0"`,
      example: [true, false, 'true', 'false']
    };
  }

  /**
   * Creates a validator for memory size in MB
   */
  static memorySize(name: string, min = 128, max = 16384): ValidationRule<any> {
    return {
      validate: (value: any) => {
        const num = Number(value);
        if (isNaN(num)) {
          return `${name} must be a valid number (MB), got: ${typeof value} "${value}"`;
        }
        if (!Number.isInteger(num)) {
          return `${name} must be an integer (MB), got decimal: ${num}`;
        }
        if (num < min) {
          return `${name} too small: ${num}MB (minimum: ${min}MB for stable operation)`;
        }
        if (num > max) {
          return `${name} too large: ${num}MB (maximum: ${max}MB to prevent system issues)`;
        }
        return true;
      },
      suggestion: `Use memory size in MB between ${min} and ${max}`,
      example: [512, 1024, 2048, 4096]
    };
  }
}

/**
 * Complete validation schema for the configuration
 */
export const CONFIG_VALIDATION_SCHEMA: ValidationSchema = {
  parseGlob: ValidationUtils.stringArray('parseGlob', 1),
  watchGlob: ValidationUtils.stringArray('watchGlob', 0),
  
  outputDir: ValidationUtils.directoryPath('outputDir'),
  
  topK: ValidationUtils.numericRange(1, 1000, 'topK'),
  snippetLines: ValidationUtils.numericRange(1, 200, 'snippetLines'),
  concurrency: ValidationUtils.numericRange(1, 32, 'concurrency'),
  batchSize: ValidationUtils.numericRange(1, 5000, 'batchSize'),
  
  modelHost: ValidationUtils.urlString('modelHost'),
  enableTelemetry: ValidationUtils.boolean('enableTelemetry'),
  
  indexParams: {
    efConstruction: ValidationUtils.numericRange(16, 800, 'indexParams.efConstruction'),
    M: ValidationUtils.numericRange(4, 64, 'indexParams.M')
  },
  
  model: {
    defaultModel: ValidationUtils.nonEmptyString('model.defaultModel'),
    modelsDir: ValidationUtils.directoryPath('model.modelsDir'),
    downloadTimeout: ValidationUtils.numericRange(1000, 300000, 'model.downloadTimeout'),
    maxConcurrentDownloads: ValidationUtils.numericRange(1, 10, 'model.maxConcurrentDownloads'),
    showProgress: ValidationUtils.boolean('model.showProgress')
  },
  
  embeddings: {
    model: ValidationUtils.nonEmptyString('embeddings.model'),
    modelPath: ValidationUtils.directoryPath('embeddings.modelPath'),
    batchSize: ValidationUtils.numericRange(1, 128, 'embeddings.batchSize'),
    maxConcurrency: ValidationUtils.numericRange(1, 8, 'embeddings.maxConcurrency'),
    memoryLimit: ValidationUtils.memorySize('embeddings.memoryLimit'),
    showProgress: ValidationUtils.boolean('embeddings.showProgress'),
    enableConfidenceScoring: ValidationUtils.boolean('embeddings.enableConfidenceScoring'),
    
    textProcessing: {
      maxTokenLength: ValidationUtils.numericRange(100, 100000, 'embeddings.textProcessing.maxTokenLength'),
      preserveCodeStructure: ValidationUtils.boolean('embeddings.textProcessing.preserveCodeStructure'),
      normalizeWhitespace: ValidationUtils.boolean('embeddings.textProcessing.normalizeWhitespace'),
      preserveComments: ValidationUtils.boolean('embeddings.textProcessing.preserveComments'),
      maxSnippetLength: ValidationUtils.numericRange(50, 10000, 'embeddings.textProcessing.maxSnippetLength')
    }
  },
  
  fileWatching: {
    watchPaths: ValidationUtils.stringArray('fileWatching.watchPaths', 1),
    includePatterns: ValidationUtils.stringArray('fileWatching.includePatterns', 0),
    excludePatterns: ValidationUtils.stringArray('fileWatching.excludePatterns', 0),
    debounceMs: ValidationUtils.numericRange(0, 10000, 'fileWatching.debounceMs'),
    batchSize: ValidationUtils.numericRange(1, 1000, 'fileWatching.batchSize'),
    enableRecursive: ValidationUtils.boolean('fileWatching.enableRecursive'),
    followSymlinks: ValidationUtils.boolean('fileWatching.followSymlinks')
  },
  
  // CLI-specific options
  verbose: ValidationUtils.boolean('verbose'),
  debug: ValidationUtils.boolean('debug'),
  jsonLogs: ValidationUtils.boolean('jsonLogs'),
  logFile: ValidationUtils.directoryPath('logFile')
};