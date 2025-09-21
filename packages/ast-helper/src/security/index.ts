/**
 * Security Audit and Vulnerability Assessment
 * Main entry point for security system
 */

export * from './types.js';
export * from './config.js';
export * from './auditor.js';

// Re-export main classes for convenience
export { ComprehensiveSecurityAuditor } from './auditor.js';
export { SecurityConfigValidator, DEFAULT_SECURITY_CONFIG } from './config.js';