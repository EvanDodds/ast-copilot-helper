/**
 * Tests for configuration system
 * Covers configuration loading, validation, and precedence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../src/config/manager.js';
import { DEFAULT_CONFIG, validateConfig } from '../src/config/defaults.js';
import { parseEnvironmentConfig } from '../src/config/environment.js';
import { parseCliArgs } from '../src/config/cli.js';
import type { CliArgs, Config } from '../src/types.js';

describe('Configuration System', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Configuration', () => {
    it('should provide valid default configuration', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.parseGlob).toEqual(['src/**/*.ts', 'src/**/*.js', 'src/**/*.py']);
      expect(DEFAULT_CONFIG.watchGlob).toEqual(['src/**/*']);
      expect(DEFAULT_CONFIG.topK).toBe(5);
      expect(DEFAULT_CONFIG.snippetLines).toBe(10);
      expect(DEFAULT_CONFIG.indexParams.efConstruction).toBe(200);
      expect(DEFAULT_CONFIG.indexParams.M).toBe(16);
      expect(DEFAULT_CONFIG.modelHost).toBe('https://huggingface.co');
      expect(DEFAULT_CONFIG.enableTelemetry).toBe(false);
      expect(DEFAULT_CONFIG.concurrency).toBe(4);
      expect(DEFAULT_CONFIG.batchSize).toBe(100);
    });
    
    it('should validate and fill missing values with defaults', () => {
      const config = validateConfig({});
      expect(config).toEqual(DEFAULT_CONFIG);
    });
    
    it('should preserve valid configuration values', () => {
      const input = {
        topK: 10,
        snippetLines: 20,
        enableTelemetry: true
      };
      
      const config = validateConfig(input);
      expect(config.topK).toBe(10);
      expect(config.snippetLines).toBe(20);
      expect(config.enableTelemetry).toBe(true);
      // Other values should be defaults
      expect(config.parseGlob).toEqual(DEFAULT_CONFIG.parseGlob);
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error for invalid topK', () => {
      expect(() => validateConfig({ topK: 0 })).toThrow('Configuration validation failed');
      expect(() => validateConfig({ topK: 1001 })).toThrow('Configuration validation failed');
    });
    
    it('should throw error for invalid snippetLines', () => {
      expect(() => validateConfig({ snippetLines: 0 })).toThrow('Configuration validation failed');
      expect(() => validateConfig({ snippetLines: 201 })).toThrow('Configuration validation failed');
    });
    
    it('should throw error for invalid concurrency', () => {
      expect(() => validateConfig({ concurrency: 0 })).toThrow('Configuration validation failed');
      expect(() => validateConfig({ concurrency: 33 })).toThrow('Configuration validation failed');
    });
    
    it('should throw error for invalid index parameters', () => {
      expect(() => validateConfig({ indexParams: { efConstruction: 15 } })).toThrow('Configuration validation failed');
      expect(() => validateConfig({ indexParams: { M: 3 } })).toThrow('Configuration validation failed');
    });
    
    it('should throw error for invalid modelHost', () => {
      expect(() => validateConfig({ modelHost: '' })).toThrow('Configuration validation failed');
      expect(() => validateConfig({ modelHost: '   ' })).toThrow('Configuration validation failed');
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should parse numeric environment variables', () => {
      process.env.AST_COPILOT_TOP_K = '15';
      process.env.AST_COPILOT_SNIPPET_LINES = '25';
      process.env.AST_COPILOT_CONCURRENCY = '8';
      
      const config = parseEnvironmentConfig();
      expect(config.topK).toBe(15);
      expect(config.snippetLines).toBe(25);
      expect(config.concurrency).toBe(8);
    });
    
    it('should parse boolean environment variables', () => {
      process.env.AST_COPILOT_ENABLE_TELEMETRY = 'true';
      const config = parseEnvironmentConfig();
      expect(config.enableTelemetry).toBe(true);
      
      process.env.AST_COPILOT_ENABLE_TELEMETRY = 'false';
      const config2 = parseEnvironmentConfig();
      expect(config2.enableTelemetry).toBe(false);
    });
    
    it('should parse string environment variables', () => {
      process.env.AST_COPILOT_MODEL_HOST = 'https://example.com';
      const config = parseEnvironmentConfig();
      expect(config.modelHost).toBe('https://example.com');
    });
    
    it('should parse array environment variables', () => {
      process.env.AST_COPILOT_PARSE_GLOB = 'src/**/*.ts,lib/**/*.js,test/**/*.py';
      const config = parseEnvironmentConfig();
      expect(config.parseGlob).toEqual(['src/**/*.ts', 'lib/**/*.js', 'test/**/*.py']);
    });
    
    it('should parse index parameters', () => {
      process.env.AST_COPILOT_EF_CONSTRUCTION = '400';
      process.env.AST_COPILOT_M = '32';
      const config = parseEnvironmentConfig();
      expect(config.indexParams?.efConstruction).toBe(400);
      expect(config.indexParams?.M).toBe(32);
    });
  });

  describe('CLI Argument Parsing', () => {
    it('should parse CLI arguments correctly', () => {
      const args: CliArgs = {
        'top-k': 20,
        'snippet-lines': 15,
        'enable-telemetry': true,
        'parse-glob': 'src/**/*.ts,lib/**/*.js'
      };
      
      const config = parseCliArgs(args);
      expect(config.topK).toBe(20);
      expect(config.snippetLines).toBe(15);
      expect(config.enableTelemetry).toBe(true);
      expect(config.parseGlob).toEqual(['src/**/*.ts', 'lib/**/*.js']);
    });
    
    it('should handle index parameters', () => {
      const args: CliArgs = {
        'ef-construction': 300,
        'M': 24
      };
      
      const config = parseCliArgs(args);
      expect(config.indexParams?.efConstruction).toBe(300);
      expect(config.indexParams?.M).toBe(24);
    });
  });

  describe('ConfigManager Integration', () => {
    let configManager: ConfigManager;
    
    beforeEach(() => {
      configManager = new ConfigManager();
    });
    
    it('should load configuration with defaults only', async () => {
      const config = await configManager.loadConfig('/tmp/test-workspace');
      expect(config).toEqual(DEFAULT_CONFIG);
    });
    
    it('should merge CLI arguments with defaults', async () => {
      const cliArgs: CliArgs = {
        'top-k': 15,
        'enable-telemetry': true
      };
      
      const config = await configManager.loadConfig('/tmp/test-workspace', cliArgs);
      expect(config.topK).toBe(15);
      expect(config.enableTelemetry).toBe(true);
      // Other values should be defaults
      expect(config.snippetLines).toBe(DEFAULT_CONFIG.snippetLines);
      expect(config.parseGlob).toEqual(DEFAULT_CONFIG.parseGlob);
    });
    
    it('should handle configuration loading errors gracefully', async () => {
      const invalidArgs: CliArgs = {
        'top-k': 1001 // Invalid value - exceeds max of 1000
      };
      
      await expect(configManager.loadConfig('/tmp/test-workspace', invalidArgs))
        .rejects.toThrow('Configuration validation failed');
    });
  });
});
