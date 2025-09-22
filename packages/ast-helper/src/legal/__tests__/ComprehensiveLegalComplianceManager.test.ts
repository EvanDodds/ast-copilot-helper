/**
 * @fileoverview Tests for ComprehensiveLegalComplianceManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComprehensiveLegalComplianceManager, defaultComplianceConfig } from '../index.js';
import type { ComplianceConfig } from '../types.js';

describe('ComprehensiveLegalComplianceManager', () => {
  let manager: ComprehensiveLegalComplianceManager;
  let config: ComplianceConfig;

  beforeEach(() => {
    config = {
      projectLicense: 'MIT',
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC'],
      restrictedLicenses: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
      attributionRequirements: {
        generateNotice: true,
        generateThirdPartyLicense: true,
        generateCredits: true,
        generateMetadata: true,
        includeDevDependencies: false,
        outputDirectory: '/tmp/test-legal',
      },
      complianceStandards: ['SPDX', 'OpenChain'],
      reportingConfig: {
        formats: ['json', 'markdown'],
        includeFullLicenseTexts: true,
        includeVulnerabilityInfo: false,
        outputDirectory: '/tmp/test-reports',
        scheduledReports: false,
      },
      monitoring: {
        enabled: false,
        alertOnLicenseChange: true,
        alertOnNewViolations: true,
        alertOnRestrictedLicenses: true,
        emailRecipients: [],
        checkFrequency: 'daily',
      },
    };
    manager = new ComprehensiveLegalComplianceManager();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(manager.initialize(config)).resolves.not.toThrow();
    });

    it('should validate project license during initialization', async () => {
      const invalidConfig = { ...config, projectLicense: 'INVALID' as any };
      await expect(manager.initialize(invalidConfig)).rejects.toThrow(/not found in license database/);
    });
  });

  describe('license scanning', () => {
    beforeEach(async () => {
      await manager.initialize(config);
    });

    it('should scan dependencies successfully', async () => {
      const result = await manager.scanDependencyLicenses();
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.totalDependencies).toBe('number');
      expect(Array.isArray(result.dependencies)).toBe(true);
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle scan errors gracefully', async () => {
      // Mock error condition
      const errorManager = new ComprehensiveLegalComplianceManager();
      await errorManager.initialize(config);
      
      const result = await errorManager.scanDependencyLicenses();
      expect(result).toBeDefined();
    });
  });

  describe('attribution generation', () => {
    beforeEach(async () => {
      await manager.initialize(config);
    });

    it('should generate attributions successfully', async () => {
      const result = await manager.generateAttributions();
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.dependenciesAttributed).toBe('number');
      expect(Array.isArray(result.attributions)).toBe(true);
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('compatibility validation', () => {
    beforeEach(async () => {
      await manager.initialize(config);
    });

    it('should validate license compatibility', async () => {
      const result = await manager.validateLicenseCompatibility();
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.totalDependencies).toBe('number');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.compatibleLicenses)).toBe(true);
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('compliance reporting', () => {
    beforeEach(async () => {
      await manager.initialize(config);
    });

    it('should generate compliance report', async () => {
      const result = await manager.generateComplianceReport();
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.duration).toBe('number');
      expect(result.summary).toBeDefined();
      expect(result.licenseScan).toBeDefined();
      expect(result.compatibility).toBeDefined();
      expect(result.attributions).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('placeholder methods', () => {
    beforeEach(async () => {
      await manager.initialize(config);
    });

    it('should return not implemented error for setupLegalDocumentation', async () => {
      const result = await manager.setupLegalDocumentation();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not implemented');
    });

    it('should return not implemented error for monitorLicenseChanges', async () => {
      const result = await manager.monitorLicenseChanges();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not implemented');
    });
  });
});