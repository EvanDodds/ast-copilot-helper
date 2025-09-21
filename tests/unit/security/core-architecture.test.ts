/**
 * Core Security Architecture Tests
 * Tests for security types, configuration, and auditor framework
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ComprehensiveSecurityAuditor,
  SecurityConfigValidator,
  DEFAULT_SECURITY_CONFIG,
  SecurityConfig,
  AuditLevel
} from '../../../packages/ast-helper/src/security/index.js';

describe('Core Security Architecture', () => {
  describe('SecurityConfigValidator', () => {
    it('should validate default configuration successfully', () => {
      const config = SecurityConfigValidator.validate({});
      
      expect(config.auditLevel).toBe('comprehensive');
      expect(config.dependencyScanning).toBe(true);
      expect(config.complianceFrameworks).toContain('OWASP');
      expect(config.maxAuditTime).toBe(300000);
    });

    it('should throw error for invalid audit level', () => {
      expect(() => {
        SecurityConfigValidator.validate({ auditLevel: 'invalid' as AuditLevel });
      }).toThrow('Invalid audit level: invalid');
    });

    it('should throw error for invalid compliance framework', () => {
      expect(() => {
        SecurityConfigValidator.validate({ 
          complianceFrameworks: ['INVALID_FRAMEWORK'] 
        });
      }).toThrow('Invalid compliance frameworks: INVALID_FRAMEWORK');
    });

    it('should validate max audit time minimum', () => {
      expect(() => {
        SecurityConfigValidator.validate({ maxAuditTime: 500 });
      }).toThrow('Maximum audit time must be at least 1000ms');
    });

    it('should generate configuration for basic audit level', () => {
      const config = SecurityConfigValidator.getConfigForLevel('basic');
      
      expect(config.auditLevel).toBe('basic');
      expect(config.includeThirdParty).toBe(false);
      expect(config.penetrationTesting).toBe(false);
      expect(config.complianceFrameworks).toEqual(['OWASP']);
      expect(config.maxAuditTime).toBe(60000);
    });

    it('should generate configuration for comprehensive audit level', () => {
      const config = SecurityConfigValidator.getConfigForLevel('comprehensive');
      
      expect(config.auditLevel).toBe('comprehensive');
      expect(config.includeThirdParty).toBe(true);
      expect(config.penetrationTesting).toBe(false);
      expect(config.complianceFrameworks).toEqual(['OWASP', 'CWE']);
      expect(config.maxAuditTime).toBe(300000);
    });

    it('should generate configuration for enterprise audit level', () => {
      const config = SecurityConfigValidator.getConfigForLevel('enterprise');
      
      expect(config.auditLevel).toBe('enterprise');
      expect(config.includeThirdParty).toBe(true);
      expect(config.penetrationTesting).toBe(true);
      expect(config.complianceFrameworks).toEqual(['OWASP', 'CWE', 'NIST', 'ISO27001']);
      expect(config.maxAuditTime).toBe(900000);
    });

    it('should merge custom rules with defaults', () => {
      const customRules = [{
        id: 'custom-rule',
        name: 'Custom Security Rule',
        description: 'A custom security rule for testing',
        severity: 'high' as const,
        pattern: /test-pattern/
      }];

      const mergedRules = SecurityConfigValidator.mergeRules(customRules);
      
      expect(mergedRules.length).toBeGreaterThan(5); // Default rules plus custom
      expect(mergedRules.find(rule => rule.id === 'custom-rule')).toBeDefined();
      expect(mergedRules.find(rule => rule.id === 'hardcoded-secrets')).toBeDefined();
    });
  });

  describe('ComprehensiveSecurityAuditor', () => {
    let auditor: ComprehensiveSecurityAuditor;
    let config: SecurityConfig;

    beforeEach(() => {
      auditor = new ComprehensiveSecurityAuditor();
      config = SecurityConfigValidator.getConfigForLevel('basic');
    });

    it('should initialize successfully with valid configuration', async () => {
      await expect(auditor.initialize(config)).resolves.not.toThrow();
    });

    it('should throw error when performing audit without initialization', async () => {
      await expect(auditor.performComprehensiveAudit()).rejects.toThrow(
        'Security auditor not initialized. Call initialize() first.'
      );
    });

    it('should perform comprehensive audit after initialization', async () => {
      await auditor.initialize(config);
      
      const report = await auditor.performComprehensiveAudit();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.duration).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.overallSeverity).toMatch(/^(low|medium|high|critical)$/);
      expect(Array.isArray(report.auditSections)).toBe(true);
      expect(report.summary).toBeTruthy();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.complianceStatus).toBeDefined();
    });

    it('should scan vulnerabilities successfully', async () => {
      await auditor.initialize(config);
      
      const report = await auditor.scanVulnerabilities();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.totalDependencies).toBe('number');
      expect(Array.isArray(report.vulnerabilities)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.overallRisk).toMatch(/^(low|medium|high|critical)$/);
    });

    it('should audit dependencies successfully', async () => {
      await auditor.initialize(config);
      
      const report = await auditor.auditDependencies();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.totalDependencies).toBe('number');
      expect(Array.isArray(report.vulnerabilities)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.overallRisk).toMatch(/^(low|medium|high|critical)$/);
    });

    it('should validate security compliance successfully', async () => {
      await auditor.initialize(config);
      
      const report = await auditor.validateSecurityCompliance();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(Array.isArray(report.frameworks)).toBe(true);
      expect(typeof report.overallScore).toBe('number');
      expect(typeof report.compliant).toBe('boolean');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should test security controls successfully', async () => {
      await auditor.initialize(config);
      
      const report = await auditor.testSecurityControls();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.testsRun).toBe('number');
      expect(typeof report.testsPassed).toBe('number');
      expect(typeof report.testsFailed).toBe('number');
      expect(typeof report.vulnerabilitiesFound).toBe('number');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should handle audit errors gracefully', async () => {
      // Initialize with invalid config to trigger error
      const invalidConfig = { ...config, maxAuditTime: -1 };
      
      await expect(auditor.initialize(invalidConfig)).rejects.toThrow();
    });

    it('should calculate security score correctly', async () => {
      await auditor.initialize(config);
      
      const report = await auditor.performComprehensiveAudit();
      
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      
      // Verify score correlates with severity
      if (report.overallSeverity === 'critical') {
        expect(report.overallScore).toBeLessThan(50);
      } else if (report.overallSeverity === 'high') {
        expect(report.overallScore).toBeLessThan(70);
      }
    });

    it('should include all required audit sections', async () => {
      const comprehensiveConfig = SecurityConfigValidator.getConfigForLevel('comprehensive');
      await auditor.initialize(comprehensiveConfig);
      
      const report = await auditor.performComprehensiveAudit();
      
      const sectionNames = report.auditSections.map(section => section.name);
      expect(sectionNames).toContain('code_security_analysis');
      expect(sectionNames).toContain('configuration_security');
      expect(sectionNames).toContain('dependency_vulnerabilities');
      expect(sectionNames).toContain('input_validation');
      expect(sectionNames).toContain('filesystem_security');
      expect(sectionNames).toContain('mcp_security');
    });

    it('should respect audit level configuration', async () => {
      // Test basic level
      const basicConfig = SecurityConfigValidator.getConfigForLevel('basic');
      await auditor.initialize(basicConfig);
      
      let report = await auditor.performComprehensiveAudit();
      expect(report.auditSections.length).toBeGreaterThan(0);
      
      // Test enterprise level
      const enterpriseConfig = SecurityConfigValidator.getConfigForLevel('enterprise');
      await auditor.initialize(enterpriseConfig);
      
      report = await auditor.performComprehensiveAudit();
      expect(report.auditSections.length).toBeGreaterThan(0);
    });
  });

  describe('Default Security Rules', () => {
    it('should include hardcoded secrets detection', () => {
      const rules = SecurityConfigValidator.mergeRules();
      const secretsRule = rules.find(rule => rule.id === 'hardcoded-secrets');
      
      expect(secretsRule).toBeDefined();
      expect(secretsRule?.severity).toBe('critical');
      expect(secretsRule?.pattern).toBeInstanceOf(RegExp);
    });

    it('should include SQL injection detection', () => {
      const rules = SecurityConfigValidator.mergeRules();
      const sqlRule = rules.find(rule => rule.id === 'sql-injection-patterns');
      
      expect(sqlRule).toBeDefined();
      expect(sqlRule?.severity).toBe('high');
      expect(sqlRule?.pattern).toBeInstanceOf(RegExp);
    });

    it('should include path traversal detection', () => {
      const rules = SecurityConfigValidator.mergeRules();
      const pathRule = rules.find(rule => rule.id === 'path-traversal');
      
      expect(pathRule).toBeDefined();
      expect(pathRule?.severity).toBe('high');
      expect(pathRule?.pattern).toBeInstanceOf(RegExp);
    });

    it('should include command injection detection', () => {
      const rules = SecurityConfigValidator.mergeRules();
      const commandRule = rules.find(rule => rule.id === 'command-injection');
      
      expect(commandRule).toBeDefined();
      expect(commandRule?.severity).toBe('critical');
      expect(commandRule?.pattern).toBeInstanceOf(RegExp);
    });

    it('should include XSS pattern detection', () => {
      const rules = SecurityConfigValidator.mergeRules();
      const xssRule = rules.find(rule => rule.id === 'xss-patterns');
      
      expect(xssRule).toBeDefined();
      expect(xssRule?.severity).toBe('medium');
      expect(xssRule?.pattern).toBeInstanceOf(RegExp);
    });
  });
});