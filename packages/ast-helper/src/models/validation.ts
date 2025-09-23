/**
 * Model configuration validation and utility functions
 */

import type { ModelConfig, ValidationResult, ModelRequirements } from './types.js';
import { parse as parseUrl } from 'url';
import * as os from 'os';

/**
 * Validate a complete model configuration
 */
export function validateModelConfig(config: ModelConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Model name is required and must be a string');
  } else if (!/^[a-zA-Z0-9\-_]+$/.test(config.name)) {
    errors.push('Model name must contain only letters, numbers, hyphens, and underscores');
  }

  if (!config.version || typeof config.version !== 'string') {
    errors.push('Model version is required and must be a string');
  } else if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9\-]+)?$/.test(config.version)) {
    warnings.push('Model version should follow semantic versioning (e.g., 1.0.0)');
  }

  // Validate URL
  const urlValidation = validateUrl(config.url);
  if (!urlValidation.valid) {
    errors.push(...urlValidation.errors);
  }

  // Validate checksum
  if (!config.checksum || typeof config.checksum !== 'string') {
    errors.push('Model checksum is required and must be a string');
  } else if (!/^[a-fA-F0-9]{64}$/.test(config.checksum)) {
    errors.push('Model checksum must be a valid SHA256 hash (64 hex characters)');
  }

  // Validate size
  if (typeof config.size !== 'number' || config.size <= 0) {
    errors.push('Model size must be a positive number');
  }

  // Validate format
  const validFormats = ['onnx', 'pytorch', 'tensorflow', 'json'];
  if (!validFormats.includes(config.format)) {
    errors.push(`Model format must be one of: ${validFormats.join(', ')}`);
  }

  // Validate dimensions
  if (typeof config.dimensions !== 'number' || config.dimensions < 0) {
    errors.push('Model dimensions must be a non-negative number');
  }

  // Validate tokenizer if present
  if (config.tokenizer) {
    const tokenizerValidation = validateModelConfig(config.tokenizer);
    if (!tokenizerValidation.valid) {
      errors.push(...tokenizerValidation.errors.map(e => `Tokenizer: ${e}`));
      warnings.push(...tokenizerValidation.warnings.map(w => `Tokenizer: ${w}`));
    }
  }

  // Validate requirements if present
  if (config.requirements) {
    const requirementsValidation = validateRequirements(config.requirements);
    if (!requirementsValidation.valid) {
      warnings.push(...requirementsValidation.errors);
    }
  }

  // Additional warnings
  if (config.size > 1000000000) { // > 1GB
    warnings.push('Large model size (>1GB) may cause memory issues on some systems');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate a URL for security and format requirements
 */
export function validateUrl(url: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!url || typeof url !== 'string') {
    errors.push('URL is required and must be a string');
    return { valid: false, errors, warnings };
  }

  try {
    const parsed = parseUrl(url);
    
    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      errors.push('URL must use HTTPS protocol for security');
    }

    // Must have valid hostname
    if (!parsed.hostname) {
      errors.push('URL must have a valid hostname');
    } else {
      // Validate against known safe sources
      const allowedHosts = [
        'huggingface.co',
        'github.com',
        'raw.githubusercontent.com'
      ];
      
      if (!allowedHosts.some(host => parsed.hostname!.endsWith(host))) {
        warnings.push(`URL host '${parsed.hostname}' is not in the list of known safe sources`);
      }
    }

    // Must have valid path
    if (!parsed.pathname || parsed.pathname === '/') {
      errors.push('URL must have a valid file path');
    }

  } catch (error) {
    errors.push(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate model requirements against current system
 */
export function validateRequirements(requirements: ModelRequirements): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Node.js version if specified
  if (requirements.nodeVersion) {
    const currentVersion = process.version;
    if (!isVersionCompatible(currentVersion, requirements.nodeVersion)) {
      warnings.push(`Node.js version ${requirements.nodeVersion} required, current: ${currentVersion}`);
    }
  }

  // Check available memory if specified
  if (requirements.memoryMB) {
    const availableMemory = Math.floor(os.totalmem() / (1024 * 1024));
    if (availableMemory < requirements.memoryMB) {
      warnings.push(`Model requires ${requirements.memoryMB}MB memory, available: ${availableMemory}MB`);
    }
  }

  // Check architecture if specified
  if (requirements.architecture && requirements.architecture.length > 0) {
    const currentArch = os.arch();
    if (!requirements.architecture.includes(currentArch)) {
      errors.push(`Model requires architecture ${requirements.architecture.join('|')}, current: ${currentArch}`);
    }
  }

  // Check platform if specified
  if (requirements.platforms && requirements.platforms.length > 0) {
    const currentPlatform = os.platform();
    if (!requirements.platforms.includes(currentPlatform)) {
      errors.push(`Model requires platform ${requirements.platforms.join('|')}, current: ${currentPlatform}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if current version meets minimum version requirement
 */
function isVersionCompatible(current: string, required: string): boolean {
  // Simple semantic version comparison - remove 'v' prefix if present
  const currentParts = current.replace(/^v/, '').split('.').map(Number);
  const requiredParts = required.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const requiredPart = requiredParts[i] || 0;

    if (currentPart > requiredPart) {
return true;
}
    if (currentPart < requiredPart) {
return false;
}
  }

  return true; // Equal versions are compatible
}

/**
 * Get system compatibility information
 */
export function getSystemInfo() {
  return {
    nodeVersion: process.version,
    architecture: os.arch(),
    platform: os.platform(),
    totalMemoryMB: Math.floor(os.totalmem() / (1024 * 1024)),
    freeMemoryMB: Math.floor(os.freemem() / (1024 * 1024))
  };
}