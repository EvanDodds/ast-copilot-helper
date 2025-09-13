/**
 * Model configurations for supported embedding models
 * This defines the authoritative list of models available for download
 */

import { ModelConfig } from './types.js';

/**
 * Supported embedding models with their configurations
 * All URLs must be HTTPS and point to official sources
 * Checksums must be verified and updated when models change
 */
export const SUPPORTED_MODELS: ModelConfig[] = [
  {
    name: 'codebert-base',
    version: '1.0.0',
    url: 'https://huggingface.co/microsoft/codebert-base/resolve/main/model.onnx',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Placeholder - must be updated with real checksum
    size: 438271875, // ~418MB
    format: 'onnx',
    dimensions: 768,
    description: 'Microsoft CodeBERT base model in ONNX format for code understanding and generation',
    requirements: {
      memoryMB: 2048,
      architecture: ['x64', 'arm64'],
      platforms: ['win32', 'darwin', 'linux']
    },
    tokenizer: {
      name: 'codebert-base-tokenizer',
      version: '1.0.0',
      url: 'https://huggingface.co/microsoft/codebert-base/resolve/main/tokenizer.json',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Placeholder
      size: 2113024, // ~2MB
      format: 'json',
      dimensions: 0, // Tokenizer doesn't produce embeddings
      description: 'CodeBERT tokenizer configuration'
    }
  },
  {
    name: 'all-minilm-l6-v2',
    version: '1.0.0', 
    url: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/model.onnx',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Placeholder
    size: 90900000, // ~87MB
    format: 'onnx',
    dimensions: 384,
    description: 'Sentence Transformers all-MiniLM-L6-v2 model - lightweight and fast general-purpose embeddings',
    requirements: {
      memoryMB: 1024,
      architecture: ['x64', 'arm64'],
      platforms: ['win32', 'darwin', 'linux']
    }
  },
  {
    name: 'unixcoder-base',
    version: '1.0.0',
    url: 'https://huggingface.co/microsoft/unixcoder-base/resolve/main/model.onnx',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Placeholder
    size: 496000000, // ~473MB
    format: 'onnx',
    dimensions: 768,
    description: 'Microsoft UniXcoder base model for cross-lingual code representation',
    requirements: {
      memoryMB: 2048,
      architecture: ['x64', 'arm64'],
      platforms: ['win32', 'darwin', 'linux']
    },
    tokenizer: {
      name: 'unixcoder-base-tokenizer',
      version: '1.0.0',
      url: 'https://huggingface.co/microsoft/unixcoder-base/resolve/main/tokenizer.json',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Placeholder
      size: 2200000, // ~2.1MB
      format: 'json',
      dimensions: 0,
      description: 'UniXcoder tokenizer configuration'
    }
  }
];

/**
 * Default model to use when no specific model is requested
 */
export const DEFAULT_MODEL = 'all-minilm-l6-v2';

/**
 * Model configuration registry for easy lookup
 */
export class ModelRegistry {
  private static readonly modelMap = new Map<string, ModelConfig>(
    SUPPORTED_MODELS.map(model => [model.name, model])
  );

  /**
   * Get model configuration by name
   */
  static getModel(name: string): ModelConfig | null {
    return this.modelMap.get(name) || null;
  }

  /**
   * List all available model names
   */
  static listModels(): string[] {
    return Array.from(this.modelMap.keys());
  }

  /**
   * Check if a model is supported
   */
  static isSupported(name: string): boolean {
    return this.modelMap.has(name);
  }

  /**
   * Get all model configurations
   */
  static getAllModels(): ModelConfig[] {
    return [...SUPPORTED_MODELS];
  }

  /**
   * Get models by format
   */
  static getModelsByFormat(format: string): ModelConfig[] {
    return SUPPORTED_MODELS.filter(model => model.format === format);
  }

  /**
   * Get default model configuration
   */
  static getDefaultModel(): ModelConfig {
    const defaultModel = this.getModel(DEFAULT_MODEL);
    if (!defaultModel) {
      throw new Error(`Default model '${DEFAULT_MODEL}' not found in registry`);
    }
    return defaultModel;
  }
}