/**
 * @fileoverview Tests for production readiness configuration
 */

import { describe, it, expect } from 'vitest';
import { 
  DEFAULT_PRODUCTION_READINESS_CONFIG, 
  validateConfig, 
  mergeConfig 
} from '../config.js';
import type { ProductionReadinessConfig } from '../types.js';

describe('Production Readiness Configuration', () => {
  describe('DEFAULT_PRODUCTION_READINESS_CONFIG', () => {
    it('should have valid structure', () => {
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.testing).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.performance).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.security).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.deployment).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.compliance).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.certification).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.monitoring).toBeDefined();
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.rollback).toBeDefined();
    });

    it('should have required test suites', () => {
      expect(DEFAULT_PRODUCTION_READINESS_CONFIG.testing.testSuites).toHaveLength(5);
      
      const suiteNames = DEFAULT_PRODUCTION_READINESS_CONFIG.testing.testSuites.map(s => s.name);
      expect(suiteNames).toContain('cli-integration');
      expect(suiteNames).toContain('mcp-integration');
      expect(suiteNames).toContain('vscode-integration');
      expect(suiteNames).toContain('cross-platform');
      expect(suiteNames).toContain('e2e-workflows');
    });

    it('should have realistic performance targets', () => {
      const targets = DEFAULT_PRODUCTION_READINESS_CONFIG.performance.targets;
      
      expect(targets.cliQueryResponseTime).toBe(500); // 500ms
      expect(targets.mcpServerResponseTime).toBe(200); // 200ms
      expect(targets.memoryUsage).toBe(512 * 1024 * 1024); // 512MB
      expect(targets.parsingTime).toBe(120000); // 2 minutes
      expect(targets.concurrentConnections).toBe(5);
    });

    it('should include security configuration', () => {
      const security = DEFAULT_PRODUCTION_READINESS_CONFIG.security;
      
      expect(security.vulnerabilityScanning.enabled).toBe(true);
      expect(security.vulnerabilityScanning.severity).toContain('critical');
      expect(security.vulnerabilityScanning.severity).toContain('high');
      expect(security.vulnerabilityScanning.severity).toContain('moderate');
      
      expect(security.inputValidation.enabled).toBe(true);
      expect(security.inputValidation.testCases).toContain('sql-injection');
      expect(security.inputValidation.testCases).toContain('xss-attacks');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const result = validateConfig(DEFAULT_PRODUCTION_READINESS_CONFIG);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with no test suites', () => {
      const invalidConfig: ProductionReadinessConfig = {
        ...DEFAULT_PRODUCTION_READINESS_CONFIG,
        testing: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.testing,
          testSuites: [],
        },
      };

      const result = validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Testing configuration must include at least one test suite');
    });

    it('should reject configuration with invalid coverage', () => {
      const invalidConfig: ProductionReadinessConfig = {
        ...DEFAULT_PRODUCTION_READINESS_CONFIG,
        testing: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.testing,
          coverage: {
            minimum: -10, // Invalid
            target: 150, // Invalid
          },
        },
      };

      const result = validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Coverage minimum must be between 0 and 100');
    });

    it('should reject configuration with invalid performance targets', () => {
      const invalidConfig: ProductionReadinessConfig = {
        ...DEFAULT_PRODUCTION_READINESS_CONFIG,
        performance: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.performance,
          targets: {
            ...DEFAULT_PRODUCTION_READINESS_CONFIG.performance.targets,
            cliQueryResponseTime: -100, // Invalid
            memoryUsage: -1024, // Invalid
          },
        },
      };

      const result = validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CLI query response time target must be positive');
      expect(result.errors).toContain('Memory usage target must be positive');
    });

    it('should reject configuration with empty platforms', () => {
      const invalidConfig: ProductionReadinessConfig = {
        ...DEFAULT_PRODUCTION_READINESS_CONFIG,
        deployment: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.deployment,
          buildValidation: {
            ...DEFAULT_PRODUCTION_READINESS_CONFIG.deployment.buildValidation,
            platforms: [], // Invalid
          },
        },
      };

      const result = validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Deployment configuration must include platforms');
    });

    it('should reject configuration with no certification levels', () => {
      const invalidConfig: ProductionReadinessConfig = {
        ...DEFAULT_PRODUCTION_READINESS_CONFIG,
        certification: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.certification,
          levels: [], // Invalid
        },
      };

      const result = validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certification configuration must include levels');
    });

    it('should validate vulnerability scanning configuration', () => {
      const invalidConfig: ProductionReadinessConfig = {
        ...DEFAULT_PRODUCTION_READINESS_CONFIG,
        security: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.security,
          vulnerabilityScanning: {
            enabled: true,
            severity: [], // Invalid when enabled
          },
        },
      };

      const result = validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Vulnerability scanning requires severity levels');
    });
  });

  describe('mergeConfig', () => {
    it('should merge partial configuration with defaults', () => {
      const partialConfig = {
        performance: {
          targets: {
            cliQueryResponseTime: 1000, // Override default
            mcpServerResponseTime: 300, // Override default
            memoryUsage: 1024 * 1024 * 1024, // Override default
            parsingTime: 180000, // Override default
            concurrentConnections: 10, // Override default
          },
        },
      };

      const merged = mergeConfig(partialConfig);
      
      // Should override specified values
      expect(merged.performance.targets.cliQueryResponseTime).toBe(1000);
      expect(merged.performance.targets.mcpServerResponseTime).toBe(300);
      
      // Should keep other defaults
      expect(merged.testing.testSuites).toHaveLength(5);
      expect(merged.security.vulnerabilityScanning.enabled).toBe(true);
      expect(merged.deployment.buildValidation.platforms).toContain('linux');
    });

    it('should handle empty partial configuration', () => {
      const merged = mergeConfig({});
      
      // Should be identical to defaults
      expect(merged).toEqual(DEFAULT_PRODUCTION_READINESS_CONFIG);
    });

    it('should merge nested configuration objects', () => {
      const partialConfig = {
        testing: {
          coverage: {
            minimum: 90, // Override
            target: 95, // Override
          },
        },
        security: {
          inputValidation: {
            enabled: false, // Override
            testCases: ['custom-test'], // Override
          },
        },
      };

      const merged = mergeConfig(partialConfig);
      
      expect(merged.testing.coverage.minimum).toBe(90);
      expect(merged.testing.coverage.target).toBe(95);
      expect(merged.security.inputValidation.enabled).toBe(false);
      expect(merged.security.inputValidation.testCases).toEqual(['custom-test']);
      
      // Should keep other defaults unchanged
      expect(merged.testing.testSuites).toHaveLength(5);
      expect(merged.security.vulnerabilityScanning.enabled).toBe(true);
    });
  });
});