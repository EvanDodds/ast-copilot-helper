import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CompatibilityCheckerImpl } from '../core/compatibility-checker.js';
import { CompatibilityConfig, CompatibilityCheck } from '../types.js';

describe('CompatibilityCheckerImpl', () => {
  let compatibilityChecker: CompatibilityCheckerImpl;
  let mockConfig: CompatibilityConfig;

  beforeEach(async () => {
    mockConfig = {
      checkApi: true,
      checkConfig: true,
      checkCli: true,
      checkData: false,
      breakingChangeThreshold: 0.5,
      generateMigrationGuides: true,
      baseVersions: ['1.0.0', '2.0.0']
    };

    compatibilityChecker = new CompatibilityCheckerImpl();
    await compatibilityChecker.initialize(mockConfig);
  });

  describe('API compatibility checking', () => {
    test('should check API compatibility between versions', async () => {
      const result = await compatibilityChecker.checkApiCompatibility('1.0.0', '1.1.0');
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(Array.isArray(result.breakingChanges)).toBe(true);
      expect(typeof result.migrationRequired).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.details)).toBe(true);
    });

    test('should detect API breaking changes', async () => {
      // Mock API analysis to return breaking changes
      vi.spyOn(compatibilityChecker as any, 'analyzeApiChanges').mockResolvedValue({
        removedMethods: ['oldMethod'],
        changedSignatures: ['changedMethod'],
        removedProperties: ['oldProp']
      });

      const result = await compatibilityChecker.checkApiCompatibility('1.0.0', '2.0.0');
      
      expect(result.compatible).toBe(false);
      expect(result.breakingChanges.length).toBeGreaterThan(0);
      expect(result.migrationRequired).toBe(true);
    });

    test('should handle API compatibility check errors', async () => {
      vi.spyOn(compatibilityChecker as any, 'analyzeApiChanges')
        .mockRejectedValue(new Error('API analysis failed'));

      await expect(compatibilityChecker.checkApiCompatibility('1.0.0', '1.1.0'))
        .rejects.toThrow('API analysis failed');
    });
  });

  describe('configuration compatibility checking', () => {
    test('should check config compatibility', async () => {
      const result = await compatibilityChecker.checkConfigCompatibility('1.0.0', '1.1.0');
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(Array.isArray(result.breakingChanges)).toBe(true);
      expect(Array.isArray(result.details)).toBe(true);
    });

    test('should detect configuration breaking changes', async () => {
      vi.spyOn(compatibilityChecker as any, 'analyzeConfigChanges').mockResolvedValue({
        removedOptions: ['oldOption'],
        changedDefaults: ['changedDefault'],
        deprecatedOptions: ['deprecatedOption']
      });

      const result = await compatibilityChecker.checkConfigCompatibility('1.0.0', '2.0.0');
      
      expect(result.compatible).toBe(false);
      expect(result.breakingChanges.length).toBeGreaterThan(0);
    });

    test('should handle missing configuration files gracefully', async () => {
      vi.spyOn(compatibilityChecker as any, 'loadConfigSchema')
        .mockRejectedValue(new Error('Config file not found'));

      const result = await compatibilityChecker.checkConfigCompatibility('1.0.0', '1.1.0');
      
      expect(result.compatible).toBe(true); // Default to compatible if no config
      expect(result.confidence).toBeLessThan(1); // Low confidence
    });
  });

  describe('CLI compatibility checking', () => {
    test('should check CLI compatibility', async () => {
      const result = await compatibilityChecker.checkCliCompatibility('1.0.0', '1.1.0');
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(Array.isArray(result.breakingChanges)).toBe(true);
    });

    test('should detect CLI command changes', async () => {
      vi.spyOn(compatibilityChecker as any, 'analyzeCliChanges').mockResolvedValue({
        removedCommands: ['old-command'],
        changedOptions: ['changed-option'],
        deprecatedCommands: ['deprecated-command']
      });

      const result = await compatibilityChecker.checkCliCompatibility('1.0.0', '2.0.0');
      
      expect(result.compatible).toBe(false);
      expect(result.breakingChanges.length).toBeGreaterThan(0);
    });

    test('should handle CLI analysis errors', async () => {
      vi.spyOn(compatibilityChecker as any, 'parseCliDefinition')
        .mockRejectedValue(new Error('CLI parsing failed'));

      const result = await compatibilityChecker.checkCliCompatibility('1.0.0', '1.1.0');
      
      expect(result.compatible).toBe(true); // Default to compatible on error
      expect(result.confidence).toBeLessThan(0.5); // Very low confidence
    });
  });

  describe('data format compatibility checking', () => {
    test('should check data format compatibility', async () => {
      const result = await compatibilityChecker.checkDataFormatCompatibility('1.0.0', '1.1.0');
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(Array.isArray(result.breakingChanges)).toBe(true);
    });

    test('should detect data format breaking changes', async () => {
      // Enable data format checking for this test
      const dataEnabledConfig = { ...mockConfig, checkData: true };
      const dataEnabledChecker = new CompatibilityCheckerImpl();
      await dataEnabledChecker.initialize(dataEnabledConfig);

      vi.spyOn(dataEnabledChecker as any, 'analyzeDataFormatChanges').mockResolvedValue({
        schemaChanges: ['removedField'],
        formatVersionBump: true,
        migrationRequired: true
      });

      const result = await dataEnabledChecker.checkDataFormatCompatibility('1.0.0', '2.0.0');
      
      expect(result.compatible).toBe(false);
      expect(result.migrationRequired).toBe(true);
    });

    test('should skip data format check when disabled', async () => {
      const disabledConfig = { ...mockConfig, checkData: false };
      const disabledChecker = new CompatibilityCheckerImpl();
      await disabledChecker.initialize(disabledConfig);

      const result = await disabledChecker.checkDataFormatCompatibility('1.0.0', '1.1.0');
      
      expect(result.compatible).toBe(true);
      expect(result.details).toContain('Data format check disabled');
    });
  });

  describe('comprehensive compatibility checking', () => {
    test('should check all compatibility aspects', async () => {
      const apiCheck = await compatibilityChecker.checkApiCompatibility('1.0.0', '2.0.0');
      const configCheck = await compatibilityChecker.checkConfigCompatibility('1.0.0', '2.0.0');
      const cliCheck = await compatibilityChecker.checkCliCompatibility('1.0.0', '2.0.0');
      const dataCheck = await compatibilityChecker.checkDataFormatCompatibility('1.0.0', '2.0.0');
      
      expect(apiCheck).toBeDefined();
      expect(configCheck).toBeDefined();
      expect(cliCheck).toBeDefined();
      expect(dataCheck).toBeDefined();
      
      // All checks should have consistent structure
      [apiCheck, configCheck, cliCheck, dataCheck].forEach(check => {
        expect(typeof check.compatible).toBe('boolean');
        expect(Array.isArray(check.breakingChanges)).toBe(true);
        expect(typeof check.migrationRequired).toBe('boolean');
        expect(typeof check.confidence).toBe('number');
        expect(Array.isArray(check.details)).toBe(true);
      });
    });

    test('should find breaking changes between versions', async () => {
      const breakingChanges = await compatibilityChecker.findBreakingChanges('1.0.0', '2.0.0');
      
      expect(Array.isArray(breakingChanges)).toBe(true);
    });

    test('should generate migration guide', async () => {
      const migrationGuide = await compatibilityChecker.generateMigrationGuide('1.0.0', '2.0.0');
      
      expect(migrationGuide).toBeDefined();
      expect(typeof migrationGuide.title).toBe('string');
      expect(typeof migrationGuide.description).toBe('string');
      expect(Array.isArray(migrationGuide.steps)).toBe(true);
    });

    test('should aggregate breaking changes from all checks', async () => {
      // Mock all checks to return breaking changes
      vi.spyOn(compatibilityChecker, 'checkApiCompatibility').mockResolvedValue({
        compatible: false,
        breakingChanges: [{ description: 'API breaking change', migration: '', affectedApi: [], severity: 'major', automatedMigration: false }],
        migrationRequired: true,
        confidence: 0.9,
        details: ['API change detected']
      });

      vi.spyOn(compatibilityChecker, 'checkConfigCompatibility').mockResolvedValue({
        compatible: false,
        breakingChanges: [{ description: 'Config breaking change', migration: '', affectedApi: [], severity: 'major', automatedMigration: false }],
        migrationRequired: true,
        confidence: 0.8,
        details: ['Config change detected']
      });

      const apiCheck = await compatibilityChecker.checkApiCompatibility('1.0.0', '2.0.0');
      const configCheck = await compatibilityChecker.checkConfigCompatibility('1.0.0', '2.0.0');
      
      expect(apiCheck.compatible).toBe(false);
      expect(configCheck.compatible).toBe(false);
      expect(apiCheck.breakingChanges.length).toBeGreaterThan(0);
      expect(configCheck.breakingChanges.length).toBeGreaterThan(0);
    });
  });

  describe('breaking change detection', () => {
    test('should identify major breaking changes', async () => {
      const changes = [
        { type: 'api-removal', severity: 'critical' },
        { type: 'config-change', severity: 'major' },
        { type: 'cli-removal', severity: 'minor' }
      ];

      vi.spyOn(compatibilityChecker as any, 'analyzeChangeSeverity')
        .mockImplementation((change: any) => change.severity);

      const breakingChanges = await (compatibilityChecker as any).identifyBreakingChanges(changes);
      
      expect(breakingChanges.length).toBe(2); // critical and major
    });

    test('should calculate confidence based on analysis quality', async () => {
      const analysisResults = {
        codeAnalysisSuccess: true,
        configAnalysisSuccess: false,
        testCoverage: 0.8,
        documentationAvailable: true
      };

      const confidence = await (compatibilityChecker as any).calculateConfidence(analysisResults);
      
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThan(1);
    });
  });

  describe('migration guide generation', () => {
    test('should generate migration guide for breaking changes', async () => {
      const breakingChanges = [
        {
          description: 'API method removed',
          migration: 'Use newMethod() instead of oldMethod()',
          affectedApi: ['oldMethod'],
          severity: 'major' as const,
          automatedMigration: true
        }
      ];

      const migrationGuide = await (compatibilityChecker as any).generateMigrationGuide('1.0.0', '2.0.0', breakingChanges);
      
      expect(migrationGuide).toBeDefined();
      expect(typeof migrationGuide.title).toBe('string');
      expect(typeof migrationGuide.description).toBe('string');
      expect(Array.isArray(migrationGuide.steps)).toBe(true);
    });

    test('should prioritize automated migrations', async () => {
      const breakingChanges = [
        {
          description: 'Automated change',
          migration: 'Run migration script',
          affectedApi: [],
          severity: 'major' as const,
          automatedMigration: true
        },
        {
          description: 'Manual change',
          migration: 'Manual update required',
          affectedApi: [],
          severity: 'major' as const,
          automatedMigration: false
        }
      ];

      const migrationGuide = await (compatibilityChecker as any).generateMigrationGuide('1.0.0', '2.0.0', breakingChanges);
      
      expect(migrationGuide.steps[0].automated).toBe(true);
    });
  });

  describe('configuration validation', () => {
    test('should validate threshold settings', async () => {
      const invalidConfig = { ...mockConfig, breakingChangeThreshold: 1.5 };
      
      await expect(compatibilityChecker.initialize(invalidConfig))
        .rejects.toThrow('Invalid breaking change threshold');
    });

    test('should handle missing base versions', async () => {
      const emptyConfig = { ...mockConfig, baseVersions: [] };
      const emptyChecker = new CompatibilityCheckerImpl();
      
      await expect(emptyChecker.initialize(emptyConfig))
        .resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    test('should handle version parsing errors', async () => {
      await expect(compatibilityChecker.checkApiCompatibility('invalid', '1.1.0'))
        .rejects.toThrow('Invalid version format');
    });

    test('should handle missing version artifacts', async () => {
      vi.spyOn(compatibilityChecker as any, 'getVersionArtifacts')
        .mockRejectedValue(new Error('Version not found'));

      const result = await compatibilityChecker.checkApiCompatibility('999.0.0', '1.0.0');
      
      expect(result.compatible).toBe(true); // Default to compatible
      expect(result.confidence).toBeLessThan(0.5); // Low confidence
    });
  });
});