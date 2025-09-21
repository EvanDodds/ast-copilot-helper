/**
 * Security Audit and Vulnerability Assessment
 * Main entry point for security system
 */

export * from './types.js';
export * from './config.js';
export * from './auditor.js';
export * from './input-validator.js';

// Re-export main classes for convenience
export { ComprehensiveSecurityAuditor } from './auditor.js';
export { SecurityConfigValidator, DEFAULT_SECURITY_CONFIG } from './config.js';
export { 
  ComprehensiveInputValidator, 
  DEFAULT_INPUT_VALIDATION_CONFIG,
  InputValidationUtils 
} from './input-validator.js';
export type { InputValidator } from './input-validator.js';