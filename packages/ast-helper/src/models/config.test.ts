/**
 * Tests for model configuration system
 */

import { describe, it, expect } from 'vitest';
import { ModelRegistry, SUPPORTED_MODELS, DEFAULT_MODEL } from './config.js';
import { validateModelConfig, validateUrl, validateRequirements, getSystemInfo } from './validation.js';
import { ModelConfig } from './types.js';

describe('ModelRegistry', () => {
  it('should return all supported models', () => {
    const models = ModelRegistry.getAllModels();
    expect(models).toHaveLength(SUPPORTED_MODELS.length);
    expect(models).toEqual(SUPPORTED_MODELS);
  });

  it('should get model by name', () => {
    const codebert = ModelRegistry.getModel('codebert-base');
    expect(codebert).toBeDefined();
    expect(codebert!.name).toBe('codebert-base');
    expect(codebert!.dimensions).toBe(768);
  });

  it('should return null for unknown model', () => {
    const unknown = ModelRegistry.getModel('unknown-model');
    expect(unknown).toBeNull();
  });

  it('should list all model names', () => {
    const names = ModelRegistry.listModels();
    expect(names).toContain('codebert-base');
    expect(names).toContain('all-minilm-l6-v2');
    expect(names).toContain('unixcoder-base');
  });

  it('should check if model is supported', () => {
    expect(ModelRegistry.isSupported('codebert-base')).toBe(true);
    expect(ModelRegistry.isSupported('unknown-model')).toBe(false);
  });

  it('should get default model', () => {
    const defaultModel = ModelRegistry.getDefaultModel();
    expect(defaultModel.name).toBe(DEFAULT_MODEL);
  });

  it('should get models by format', () => {
    const onnxModels = ModelRegistry.getModelsByFormat('onnx');
    expect(onnxModels.length).toBeGreaterThan(0);
    expect(onnxModels.every((model: ModelConfig) => model.format === 'onnx')).toBe(true);
  });
});

describe('validateModelConfig', () => {
  const validConfig: ModelConfig = {
    name: 'test-model',
    version: '1.0.0',
    url: 'https://huggingface.co/test/model.onnx',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    size: 1000000,
    format: 'onnx',
    dimensions: 768,
    description: 'Test model'
  };

  it('should validate a correct model configuration', () => {
    const result = validateModelConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid model name', () => {
    const invalidConfig = { ...validConfig, name: '' };
    const result = validateModelConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Model name is required and must be a string');
  });

  it('should reject model name with invalid characters', () => {
    const invalidConfig = { ...validConfig, name: 'test@model!' };
    const result = validateModelConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Model name must contain only letters, numbers, hyphens, and underscores');
  });

  it('should warn about non-semantic version', () => {
    const invalidConfig = { ...validConfig, version: '1.0' };
    const result = validateModelConfig(invalidConfig);
    expect(result.warnings).toContain('Model version should follow semantic versioning (e.g., 1.0.0)');
  });

  it('should reject invalid checksum', () => {
    const invalidConfig = { ...validConfig, checksum: 'invalid-checksum' };
    const result = validateModelConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Model checksum must be a valid SHA256 hash (64 hex characters)');
  });

  it('should reject invalid size', () => {
    const invalidConfig = { ...validConfig, size: -1 };
    const result = validateModelConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Model size must be a positive number');
  });

  it('should reject invalid format', () => {
    const invalidConfig = { ...validConfig, format: 'invalid' as any };
    const result = validateModelConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Model format must be one of: onnx, pytorch, tensorflow, json');
  });

  it('should warn about large models', () => {
    const largeConfig = { ...validConfig, size: 2000000000 }; // 2GB
    const result = validateModelConfig(largeConfig);
    expect(result.warnings).toContain('Large model size (>1GB) may cause memory issues on some systems');
  });

  it('should validate tokenizer configuration', () => {
    const configWithTokenizer = {
      ...validConfig,
      tokenizer: {
        ...validConfig,
        name: 'test-tokenizer',
        format: 'json' as const,
        dimensions: 0
      }
    };
    const result = validateModelConfig(configWithTokenizer);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid tokenizer configuration', () => {
    const configWithInvalidTokenizer = {
      ...validConfig,
      tokenizer: {
        ...validConfig,
        name: '', // Invalid name
        format: 'json' as const
      }
    };
    const result = validateModelConfig(configWithInvalidTokenizer);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('Tokenizer:'))).toBe(true);
  });
});

describe('validateUrl', () => {
  it('should validate HTTPS URLs', () => {
    const result = validateUrl('https://huggingface.co/model.onnx');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject HTTP URLs', () => {
    const result = validateUrl('http://huggingface.co/model.onnx');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('URL must use HTTPS protocol for security');
  });

  it('should reject empty or invalid URLs', () => {
    const result1 = validateUrl('');
    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain('URL is required and must be a string');

    const result2 = validateUrl('not-a-url');
    expect(result2.valid).toBe(false);
    expect(result2.errors.length).toBeGreaterThan(0);
  });

  it('should warn about unknown hosts', () => {
    const result = validateUrl('https://unknown-host.com/model.onnx');
    expect(result.warnings).toContain("URL host 'unknown-host.com' is not in the list of known safe sources");
  });

  it('should validate known safe hosts', () => {
    const safeHosts = [
      'https://huggingface.co/model.onnx',
      'https://github.com/model.onnx',
      'https://raw.githubusercontent.com/model.onnx'
    ];

    for (const url of safeHosts) {
      const result = validateUrl(url);
      expect(result.warnings).toHaveLength(0);
    }
  });
});

describe('validateRequirements', () => {
  it('should validate empty requirements', () => {
    const result = validateRequirements({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate current system architecture', () => {
    const requirements = {
      architecture: [process.arch]
    };
    const result = validateRequirements(requirements);
    expect(result.valid).toBe(true);
  });

  it('should reject incompatible architecture', () => {
    const requirements = {
      architecture: ['incompatible-arch']
    };
    const result = validateRequirements(requirements);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('Model requires architecture'))).toBe(true);
  });

  it('should validate current system platform', () => {
    const requirements = {
      platforms: [process.platform]
    };
    const result = validateRequirements(requirements);
    expect(result.valid).toBe(true);
  });

  it('should warn about excessive memory requirements', () => {
    const requirements = {
      memoryMB: 999999999 // 999GB - definitely more than available
    };
    const result = validateRequirements(requirements);
    expect(result.warnings.some((w: string) => w.includes('Model requires') && w.includes('memory'))).toBe(true);
  });
});

describe('getSystemInfo', () => {
  it('should return system information', () => {
    const info = getSystemInfo();
    expect(info).toHaveProperty('nodeVersion');
    expect(info).toHaveProperty('architecture');
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('totalMemoryMB');
    expect(info).toHaveProperty('freeMemoryMB');
    
    expect(typeof info.nodeVersion).toBe('string');
    expect(typeof info.architecture).toBe('string');
    expect(typeof info.platform).toBe('string');
    expect(typeof info.totalMemoryMB).toBe('number');
    expect(typeof info.freeMemoryMB).toBe('number');
    
    expect(info.totalMemoryMB).toBeGreaterThan(0);
    expect(info.freeMemoryMB).toBeGreaterThan(0);
  });
});

describe('Supported Models Configuration', () => {
  it('should have valid configurations for all supported models', () => {
    for (const model of SUPPORTED_MODELS) {
      const result = validateModelConfig(model);
      
      // We expect warnings (e.g., placeholder checksums), but no errors
      expect(result.errors).toHaveLength(0);
    }
  });

  it('should have unique model names', () => {
    const names = SUPPORTED_MODELS.map((m: ModelConfig) => m.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have all required fields for each model', () => {
    const requiredFields = ['name', 'version', 'url', 'checksum', 'size', 'format', 'dimensions'];
    
    for (const model of SUPPORTED_MODELS) {
      for (const field of requiredFields) {
        expect(model).toHaveProperty(field);
        expect((model as any)[field]).toBeDefined();
      }
    }
  });
});