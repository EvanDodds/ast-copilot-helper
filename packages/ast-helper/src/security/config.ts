/**
 * Security Configuration Management
 * Handles security audit configuration validation and defaults
 */

import { SecurityConfig, AuditLevel, SecurityRule } from './types.js';

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  auditLevel: 'comprehensive',
  includeThirdParty: true,
  dependencyScanning: true,
  codeAnalysis: true,
  configurationAudit: true,
  penetrationTesting: false, // Disabled by default for safety
  complianceFrameworks: ['OWASP', 'CWE', 'NIST'],
  maxAuditTime: 300000, // 5 minutes
  customRules: [],

  // Nested configuration objects for comprehensive system
  audit: {
    level: 'comprehensive' as const,
    maxAuditTime: 300000,
    enableDependencyScanning: true,
    complianceFrameworks: ['OWASP', 'CWE', 'NIST']
  },
  
  vulnerability: {
    enabled: true,
    reportSeverities: ['low', 'medium', 'high', 'critical'],
    customPatterns: []
  },
  
  hardening: {
    enabled: true,
    rules: [] // Will be populated with DEFAULT_SECURITY_RULES
  },
  
  compliance: {
    enabled: true,
    reportFormat: 'json' as const,
    includeRemediation: true
  }
};

/**
 * Default security rules for common vulnerabilities
 */
export const DEFAULT_SECURITY_RULES: SecurityRule[] = [
  {
    id: 'hardcoded-secrets',
    name: 'Hardcoded Secrets Detection',
    description: 'Detects potential hardcoded passwords, API keys, and secrets',
    severity: 'critical',
    pattern: /(password|secret|key|token)\s*[=:]\s*['"][^'"]{8,}/i
  },
  {
    id: 'sql-injection-patterns',
    name: 'SQL Injection Patterns',
    description: 'Detects potential SQL injection vulnerabilities',
    severity: 'high',
    pattern: /(union\s+select|drop\s+table|exec\s*\(|eval\s*\()/i
  },
  {
    id: 'path-traversal',
    name: 'Path Traversal Detection',
    description: 'Detects potential path traversal vulnerabilities',
    severity: 'high',
    pattern: /\.\.(\/|\\)/
  },
  {
    id: 'command-injection',
    name: 'Command Injection Patterns',
    description: 'Detects potential command injection vulnerabilities',
    severity: 'critical',
    pattern: /(exec|eval|system|spawn)\s*\(/i
  },
  {
    id: 'xss-patterns',
    name: 'XSS Pattern Detection',
    description: 'Detects potential XSS vulnerabilities',
    severity: 'medium',
    pattern: /<script|javascript:|data:text\/html/i
  }
];

/**
 * Validates security configuration
 */
export class SecurityConfigValidator {
  /**
   * Validates and normalizes security configuration
   */
  static validate(config: Partial<SecurityConfig>): SecurityConfig {
    const validated: SecurityConfig = {
      ...DEFAULT_SECURITY_CONFIG,
      ...config
    };

    // Validate audit level
    if (!['basic', 'comprehensive', 'enterprise'].includes(validated.auditLevel)) {
      throw new Error(`Invalid audit level: ${validated.auditLevel}`);
    }

    // Validate compliance frameworks
    const validFrameworks = ['OWASP', 'CWE', 'NIST', 'ISO27001', 'SOC2'];
    const invalidFrameworks = validated.complianceFrameworks.filter(
      framework => !validFrameworks.includes(framework)
    );
    if (invalidFrameworks.length > 0) {
      throw new Error(`Invalid compliance frameworks: ${invalidFrameworks.join(', ')}`);
    }

    // Validate max audit time
    if (validated.maxAuditTime !== undefined && validated.maxAuditTime < 1000) {
      throw new Error('Maximum audit time must be at least 1000ms');
    }

    // Validate custom rules
    if (validated.customRules) {
      validated.customRules.forEach(rule => this.validateRule(rule));
    }

    return validated;
  }

  /**
   * Validates a custom security rule
   */
  private static validateRule(rule: SecurityRule): void {
    if (!rule.id || typeof rule.id !== 'string') {
      throw new Error('Security rule must have a valid ID');
    }

    if (!rule.name || typeof rule.name !== 'string') {
      throw new Error(`Security rule ${rule.id} must have a valid name`);
    }

    if (!rule.description || typeof rule.description !== 'string') {
      throw new Error(`Security rule ${rule.id} must have a valid description`);
    }

    if (!['low', 'medium', 'high', 'critical'].includes(rule.severity)) {
      throw new Error(`Security rule ${rule.id} must have a valid severity level`);
    }

    if (rule.pattern && !(rule.pattern instanceof RegExp)) {
      throw new Error(`Security rule ${rule.id} pattern must be a RegExp`);
    }

    if (rule.validator && typeof rule.validator !== 'function') {
      throw new Error(`Security rule ${rule.id} validator must be a function`);
    }

    if (!rule.pattern && !rule.validator) {
      throw new Error(`Security rule ${rule.id} must have either a pattern or validator`);
    }
  }

  /**
   * Gets configuration for specific audit level
   */
  static getConfigForLevel(level: AuditLevel, overrides: Partial<SecurityConfig> = {}): SecurityConfig {
    const baseConfig = { ...DEFAULT_SECURITY_CONFIG };

    switch (level) {
      case 'basic':
        return this.validate({
          ...baseConfig,
          auditLevel: 'basic',
          includeThirdParty: false,
          penetrationTesting: false,
          complianceFrameworks: ['OWASP'],
          maxAuditTime: 60000, // 1 minute
          audit: {
            ...baseConfig.audit,
            level: 'basic',
            maxAuditTime: 60000,
            enableDependencyScanning: false,
            complianceFrameworks: ['OWASP']
          },
          ...overrides
        });

      case 'comprehensive':
        return this.validate({
          ...baseConfig,
          auditLevel: 'comprehensive',
          includeThirdParty: true,
          penetrationTesting: false,
          complianceFrameworks: ['OWASP', 'CWE'],
          maxAuditTime: 300000, // 5 minutes
          audit: {
            ...baseConfig.audit,
            level: 'comprehensive',
            maxAuditTime: 300000,
            enableDependencyScanning: true,
            complianceFrameworks: ['OWASP', 'CWE']
          },
          ...overrides
        });

      case 'enterprise':
        return this.validate({
          ...baseConfig,
          auditLevel: 'enterprise',
          includeThirdParty: true,
          penetrationTesting: true,
          complianceFrameworks: ['OWASP', 'CWE', 'NIST', 'ISO27001'],
          maxAuditTime: 900000, // 15 minutes
          audit: {
            ...baseConfig.audit,
            level: 'enterprise',
            maxAuditTime: 900000,
            enableDependencyScanning: true,
            complianceFrameworks: ['OWASP', 'CWE', 'NIST', 'ISO27001']
          },
          ...overrides
        });

      default:
        throw new Error(`Unsupported audit level: ${level}`);
    }
  }

  /**
   * Merges custom rules with default rules
   */
  static mergeRules(customRules: SecurityRule[] = []): SecurityRule[] {
    const allRules = [...DEFAULT_SECURITY_RULES];

    // Replace default rules if custom rule has same ID
    customRules.forEach(customRule => {
      const existingIndex = allRules.findIndex(rule => rule.id === customRule.id);
      if (existingIndex >= 0) {
        allRules[existingIndex] = customRule;
      } else {
        allRules.push(customRule);
      }
    });

    return allRules;
  }
}