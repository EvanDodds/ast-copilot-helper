/**
 * Integration test for enhanced configuration validation
 * Tests the complete validation system end-to-end
 */

import { describe, it, expect } from 'vitest';
import { 
  validateConfig, 
  validateConfigDetailed,
  EnhancedConfigValidator,
  ValidationUtils,
  CONFIG_VALIDATION_SCHEMA
} from '../index.js';
import type { PartialConfig } from '../../types.js';

describe('Configuration Validation Integration', () => {
  describe('End-to-End Validation', () => {
    it('should handle complete application configuration', () => {
      const appConfig: PartialConfig = {
        parseGlob: ['**/*.ts', '**/*.js', 'src/**/*.py'],
        watchGlob: ['src/**/*', 'lib/**/*'],
        outputDir: './dist/embeddings',
        topK: 50,
        snippetLines: 10,
        concurrency: 8,
        batchSize: 200,
        modelHost: 'https://huggingface.co',
        enableTelemetry: true,
        indexParams: {
          efConstruction: 400,
          M: 32
        },
        model: {
          defaultModel: 'codebert-base',
          modelsDir: './models',
          downloadTimeout: 60000,
          maxConcurrentDownloads: 3,
          showProgress: true
        },
        embeddings: {
          model: 'all-MiniLM-L6-v2',
          modelPath: './models/embeddings',
          batchSize: 64,
          maxConcurrency: 4,
          memoryLimit: 4096,
          showProgress: true,
          enableConfidenceScoring: false,
          textProcessing: {
            maxTokenLength: 8000,
            preserveCodeStructure: true,
            normalizeWhitespace: false,
            preserveComments: true,
            maxSnippetLength: 2000
          }
        },
        fileWatching: {
          watchPaths: ['src/', 'lib/', 'tests/'],
          includePatterns: ['*.ts', '*.js', '*.py'],
          excludePatterns: ['node_modules/**', '*.test.*', '__pycache__/**'],
          debounceMs: 500,
          batchSize: 50,
          enableRecursive: true,
          followSymlinks: false
        },
        verbose: false,
        debug: false,
        jsonLogs: false
      };

      // Should validate successfully
      const config = validateConfig(appConfig);
      expect(config).toBeDefined();
      expect(config.parseGlob).toEqual(['**/*.ts', '**/*.js', 'src/**/*.py']);
      expect(config.topK).toBe(50);
      expect(config.embeddings?.memoryLimit).toBe(4096);
      expect(config.fileWatching?.enableRecursive).toBe(true);
    });

    it('should provide comprehensive error reporting for invalid config', () => {
      const invalidConfig: PartialConfig = {
        parseGlob: 'not-an-array' as any,
        topK: -10,
        snippetLines: 1000,
        concurrency: 100,
        modelHost: 'invalid-url',
        indexParams: {
          efConstruction: 1000,
          M: 1
        },
        embeddings: {
          model: '',
          modelPath: '../../../unsafe/path',
          batchSize: 200,
          maxConcurrency: 20,
          memoryLimit: 50,
          showProgress: 'maybe' as any,
          enableConfidenceScoring: true,
          textProcessing: {
            maxTokenLength: -100,
            preserveCodeStructure: 'yes' as any,
            normalizeWhitespace: true,
            preserveComments: true,
            maxSnippetLength: 50000
          }
        },
        fileWatching: {
          watchPaths: [],
          debounceMs: 20000,
          batchSize: 2000,
          enableRecursive: 'invalid' as any,
          followSymlinks: 2 as any
        },
        unknownProperty: 'should-warn'
      } as any;

      expect(() => validateConfig(invalidConfig)).toThrow(/Configuration validation failed/);
      
      const result = validateConfigDetailed(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(10);
      expect(result.warnings.length).toBeGreaterThan(0);
      
      // Check specific error types
      const parseGlobError = result.errors.find(e => e.path === 'parseGlob');
      expect(parseGlobError?.message).toContain('must be an array');
      
      const topKError = result.errors.find(e => e.path === 'topK');
      expect(topKError?.message).toContain('must be between 1 and 1000');
      
      const memoryError = result.errors.find(e => e.path === 'embeddings.memoryLimit');
      expect(memoryError?.message).toContain('too small');
      
      // Check warnings
      const unknownWarning = result.warnings.find(w => w.path === 'unknownProperty');
      expect(unknownWarning?.message).toContain('Unknown configuration property');
      
      // Check error formatting
      const formatted = EnhancedConfigValidator.formatErrors(result);
      expect(formatted).toContain('❌ Configuration validation failed');
      expect(formatted).toContain('💡'); // Suggestions
      expect(formatted).toContain('📋'); // Examples
      expect(formatted).toContain('Warnings');
    });

    it('should handle edge cases and type coercion', () => {
      const edgeCaseConfig: PartialConfig = {
        parseGlob: ['  *.ts  ', '', '  ', 'valid.js'],
        topK: '25' as any,
        enableTelemetry: 'true' as any,
        verbose: 1 as any,
        debug: 'yes' as any,
        jsonLogs: 'false' as any,
        model: {
          defaultModel: '  codebert-base  ',
          modelsDir: ' ./models/ ',
          showProgress: 0 as any
        },
        fileWatching: {
          watchPaths: ['src/'],
          includePatterns: ['', '  *.ts  ', 'valid.js'],
          enableRecursive: 'true' as any,
          followSymlinks: 'no' as any
        }
      };

      const result = validateConfigDetailed(edgeCaseConfig);
      expect(result.valid).toBe(true);
      
      const cleaned = result.cleanedConfig!;
      expect(cleaned.parseGlob).toEqual(['*.ts', 'valid.js']);
      expect(cleaned.topK).toBe(25);
      expect(cleaned.enableTelemetry).toBe(true);
      expect(cleaned.verbose).toBe(true);
      expect(cleaned.debug).toBe(true);
      expect(cleaned.jsonLogs).toBe(false);
      expect(cleaned.model?.defaultModel).toBe('codebert-base');
      expect(cleaned.model?.showProgress).toBe(false);
      expect(cleaned.fileWatching?.includePatterns).toEqual(['*.ts', 'valid.js']);
      expect(cleaned.fileWatching?.enableRecursive).toBe(true);
      expect(cleaned.fileWatching?.followSymlinks).toBe(false);
    });

    it('should validate specific scenarios from real usage', () => {
      // Scenario 1: Minimal config for development
      const minimalConfig: PartialConfig = {
        parseGlob: ['*.ts']
      };

      expect(() => validateConfig(minimalConfig)).not.toThrow();

      // Scenario 2: Production config with performance tuning
      const prodConfig: PartialConfig = {
        parseGlob: ['src/**/*.ts', 'lib/**/*.js'],
        topK: 100,
        concurrency: 16,
        batchSize: 500,
        indexParams: {
          efConstruction: 800,
          M: 64
        },
        embeddings: {
          model: 'all-MiniLM-L6-v2',
          modelPath: '/opt/models',
          batchSize: 128,
          maxConcurrency: 8,
          memoryLimit: 16384
        }
      };

      const prodResult = validateConfigDetailed(prodConfig);
      expect(prodResult.valid).toBe(true);
      expect(prodResult.warnings.length).toBe(0);

      // Scenario 3: File watching configuration
      const watchConfig: PartialConfig = {
        parseGlob: ['src/**/*.ts'],
        fileWatching: {
          watchPaths: ['src/', 'lib/', 'types/'],
          includePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          excludePatterns: ['*.test.*', '*.spec.*', 'node_modules/**'],
          debounceMs: 1000,
          batchSize: 10,
          enableRecursive: true,
          followSymlinks: false
        }
      };

      expect(() => validateConfig(watchConfig)).not.toThrow();
    });
  });

  describe('Validation Utils', () => {
    it('should provide reusable validation utilities', () => {
      const numericRule = ValidationUtils.numericRange(1, 100, 'testValue');
      
      expect(numericRule.validate(50)).toBe(true);
      expect(numericRule.validate(-5)).toContain('must be between 1 and 100');
      expect(numericRule.validate('not-a-number')).toContain('must be a valid number');
      
      const stringArrayRule = ValidationUtils.stringArray('testArray', 1);
      expect(stringArrayRule.validate(['valid'])).toBe(true);
      expect(stringArrayRule.validate([])).toContain('must contain at least 1 valid');
      expect(stringArrayRule.validate('not-array')).toContain('must be an array');
      
      const urlRule = ValidationUtils.urlString('testUrl');
      expect(urlRule.validate('https://example.com')).toBe(true);
      expect(urlRule.validate('invalid-url')).toContain('must be a valid URL');
      
      const booleanRule = ValidationUtils.boolean('testBool');
      expect(booleanRule.validate(true)).toBe(true);
      expect(booleanRule.validate('true')).toBe(true);
      expect(booleanRule.validate('yes')).toBe(true);
      expect(booleanRule.validate(1)).toBe(true);
      expect(booleanRule.validate('maybe')).toContain('must be a boolean');
    });
  });

  describe('Schema Extension', () => {
    it('should support custom validation schemas', () => {
      const customSchema = {
        ...CONFIG_VALIDATION_SCHEMA,
        customField: ValidationUtils.nonEmptyString('customField')
      };

      const customValidator = new EnhancedConfigValidator(customSchema);
      
      const result = customValidator.validate({
        parseGlob: ['*.ts'],
        customField: 'valid-value'
      } as any);
      
      expect(result.valid).toBe(true);
      
      const invalidResult = customValidator.validate({
        parseGlob: ['*.ts'],
        customField: ''
      } as any);
      
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.find(e => e.path === 'customField')).toBeDefined();
    });
  });
});