/**
 * Configuration module index
 * Exports all configuration-related functionality
 */

export { ConfigManager } from './manager.js';
export { DEFAULT_CONFIG, validateConfig, validateConfigDetailed, validateConfigLegacy } from './defaults.js';
export { parseEnvironmentConfig } from './environment.js';
export { parseCliArgs } from './cli.js';
export { loadConfigFile, loadConfigFiles, resolveConfigPaths } from './files.js';

// Enhanced validation exports
export { 
  EnhancedConfigValidator,
  defaultValidator,
  validateConfigStrict,
  type ValidationError,
  type ValidationResult
} from './enhanced-validator.js';

export {
  ValidationUtils,
  CONFIG_VALIDATION_SCHEMA,
  type ValidationRule,
  type ValidationSchema
} from './validation-schema.js';
