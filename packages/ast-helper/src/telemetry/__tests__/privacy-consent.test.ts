/**
 * @file Privacy and Consent Management Tests
 * @description Comprehensive test suite for consent management and data anonymization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PrivacyRespectingConsentManager } from '../consent/manager.js';
import { FileConsentStorage } from '../consent/storage.js';
import { PrivacyRespectingDataAnonymizer } from '../anonymization/anonymizer.js';
import { ConsentFeature, ConsentRecord, PRIVACY_LEVELS } from '../consent/types.js';
import { AnonymizationStrategy, DataCategory } from '../anonymization/types.js';
import { DEFAULT_TELEMETRY_CONFIG } from '../config.js';

describe('Privacy and Consent Management', () => {
  describe('FileConsentStorage', () => {
    let storage: FileConsentStorage;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = join(tmpdir(), `test-consent-${Date.now()}`);
      storage = new FileConsentStorage('test-app');
      // Override storage directory for testing
      (storage as any).storageDir = tempDir;
      (storage as any).consentFile = join(tempDir, 'consent.json');
      (storage as any).historyFile = join(tempDir, 'consent-history.json');
    });

    afterEach(async () => {
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should check if storage is available', async () => {
      const available = await storage.isAvailable();
      expect(available).toBe(true);
    });

    it('should save and load consent record', async () => {
      const record: ConsentRecord = {
        id: 'test-id',
        timestamp: new Date(),
        consentVersion: '1.0.0',
        appVersion: '1.0.0',
        enabled: true,
        privacyLevel: PRIVACY_LEVELS.BALANCED,
        allowedFeatures: [ConsentFeature.USAGE_ANALYTICS],
        dataRetentionDays: 90,
        shareAnonymousStats: true,
        shareErrorReports: true,
        sharePerformanceMetrics: true
      };

      await storage.saveConsent(record);
      const loaded = await storage.loadConsent();

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(record.id);
      expect(loaded?.enabled).toBe(record.enabled);
      expect(loaded?.privacyLevel).toBe(record.privacyLevel);
    });

    it('should return null for non-existent consent', async () => {
      const loaded = await storage.loadConsent();
      expect(loaded).toBeNull();
    });

    it('should maintain consent history', async () => {
      const record1: ConsentRecord = {
        id: 'test-1',
        timestamp: new Date(Date.now() - 1000),
        consentVersion: '1.0.0',
        appVersion: '1.0.0',
        enabled: true,
        privacyLevel: PRIVACY_LEVELS.STRICT,
        allowedFeatures: [],
        dataRetentionDays: 30,
        shareAnonymousStats: false,
        shareErrorReports: true,
        sharePerformanceMetrics: false
      };

      const record2: ConsentRecord = {
        ...record1,
        id: 'test-2',
        timestamp: new Date(),
        privacyLevel: PRIVACY_LEVELS.BALANCED,
        allowedFeatures: [ConsentFeature.USAGE_ANALYTICS]
      };

      await storage.saveConsent(record1);
      await storage.saveConsent(record2);

      const history = await storage.getConsentHistory();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe(record1.id);
      expect(history[1].id).toBe(record2.id);
    });

    it('should clear all consent data', async () => {
      const record: ConsentRecord = {
        id: 'test-id',
        timestamp: new Date(),
        consentVersion: '1.0.0',
        appVersion: '1.0.0',
        enabled: true,
        privacyLevel: PRIVACY_LEVELS.BALANCED,
        allowedFeatures: [ConsentFeature.USAGE_ANALYTICS],
        dataRetentionDays: 90,
        shareAnonymousStats: true,
        shareErrorReports: true,
        sharePerformanceMetrics: true
      };

      await storage.saveConsent(record);
      await storage.clearConsent();

      const loaded = await storage.loadConsent();
      const history = await storage.getConsentHistory();

      expect(loaded).toBeNull();
      expect(history).toHaveLength(0);
    });
  });

  describe('PrivacyRespectingConsentManager', () => {
    let manager: PrivacyRespectingConsentManager;
    let mockStorage: any;

    beforeEach(async () => {
      mockStorage = {
        isAvailable: vi.fn().mockResolvedValue(true),
        saveConsent: vi.fn().mockResolvedValue(undefined),
        loadConsent: vi.fn().mockResolvedValue(null),
        getConsentHistory: vi.fn().mockResolvedValue([]),
        clearConsent: vi.fn().mockResolvedValue(undefined)
      };

      manager = new PrivacyRespectingConsentManager(
        DEFAULT_TELEMETRY_CONFIG,
        '1.0.0',
        '1.0.0',
        mockStorage
      );
    });

    it('should initialize successfully', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should prevent double initialization', async () => {
      await manager.initialize();
      await expect(manager.initialize()).rejects.toThrow('already initialized');
    });

    it('should return default consent status when no consent exists', async () => {
      await manager.initialize();
      const status = await manager.getConsentStatus();

      expect(status.hasConsent).toBe(false);
      expect(status.enabled).toBe(false);
      expect(status.settings.consentGiven).toBe(false);
    });

    it('should set consent successfully', async () => {
      await manager.initialize();
      await manager.setConsent(true, '1.0.0');

      expect(mockStorage.saveConsent).toHaveBeenCalled();
      
      const status = await manager.getConsentStatus();
      expect(status.hasConsent).toBe(true);
      expect(status.enabled).toBe(true);
    });

    it('should save telemetry settings', async () => {
      await manager.initialize();
      
      const settings = {
        consentGiven: true,
        privacyLevel: PRIVACY_LEVELS.STRICT as any,
        dataRetentionDays: 30,
        allowedFeatures: [ConsentFeature.ERROR_REPORTING]
      };

      await manager.saveSettings(settings);
      expect(mockStorage.saveConsent).toHaveBeenCalled();
    });

    it('should validate consent properly', async () => {
      // Mock existing consent that needs renewal
      const oldConsent: ConsentRecord = {
        id: 'old-consent',
        timestamp: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
        consentVersion: '0.9.0',
        appVersion: '0.9.0',
        enabled: true,
        privacyLevel: PRIVACY_LEVELS.BALANCED,
        allowedFeatures: [ConsentFeature.USAGE_ANALYTICS],
        dataRetentionDays: 90,
        shareAnonymousStats: true,
        shareErrorReports: true,
        sharePerformanceMetrics: true
      };

      mockStorage.loadConsent.mockResolvedValue(oldConsent);

      await manager.initialize();
      
      // Should have reset consent due to expiry
      const status = await manager.getConsentStatus();
      expect(status.hasConsent).toBe(false);
    });

    it('should collect consent with options', async () => {
      await manager.initialize();
      
      const options = {
        showFeatureBreakdown: true,
        allowGranularConsent: true,
        defaultPrivacyLevel: PRIVACY_LEVELS.BALANCED,
        showDataRetentionOptions: true,
        preSelectedFeatures: [ConsentFeature.ERROR_REPORTING]
      };

      const consent = await manager.collectConsent(options);
      
      expect(consent.privacyLevel).toBe(PRIVACY_LEVELS.BALANCED);
      expect(consent.allowedFeatures).toContain(ConsentFeature.ERROR_REPORTING);
      expect(mockStorage.saveConsent).toHaveBeenCalled();
    });

    it('should export consent data', async () => {
      await manager.initialize();
      await manager.setConsent(true, '1.0.0');

      const exported = await manager.exportConsentData();
      
      expect(exported).toHaveProperty('current');
      expect(exported).toHaveProperty('history');
      expect(exported).toHaveProperty('exportDate');
      expect(exported).toHaveProperty('version');
    });

    it('should clear all data', async () => {
      await manager.initialize();
      await manager.clearAllData();
      
      expect(mockStorage.clearConsent).toHaveBeenCalled();
    });

    it('should handle storage failures gracefully', async () => {
      mockStorage.isAvailable.mockResolvedValue(false);
      mockStorage.saveConsent.mockRejectedValue(new Error('Storage failed'));

      await manager.initialize(); // Should not throw
      await manager.setConsent(true, '1.0.0'); // Should not throw
    });

    it('should shutdown gracefully', async () => {
      await manager.initialize();
      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('PrivacyRespectingDataAnonymizer', () => {
    let anonymizer: PrivacyRespectingDataAnonymizer;

    beforeEach(async () => {
      anonymizer = new PrivacyRespectingDataAnonymizer({
        privacyLevel: PRIVACY_LEVELS.BALANCED
      });
      await anonymizer.initialize();
    });

    afterEach(async () => {
      await anonymizer.shutdown();
    });

    it('should initialize successfully', async () => {
      const newAnonymizer = new PrivacyRespectingDataAnonymizer();
      await expect(newAnonymizer.initialize()).resolves.not.toThrow();
      await newAnonymizer.shutdown();
    });

    it('should prevent double initialization', async () => {
      await expect(anonymizer.initialize()).rejects.toThrow('already initialized');
    });

    it('should anonymize usage metrics', async () => {
      const metrics = {
        userId: 'user123',
        sessionId: 'session456',
        commands: ['ast-helper analyze', 'ast-helper extract'],
        filePaths: ['/home/user/project/src/index.ts'],
        errors: ['TypeError: Cannot read property'],
        performance: { duration: 1234, memory: 56789 }
      };

      const result = await anonymizer.anonymizeUsageMetrics(metrics);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata.privacyLevel).toBe(PRIVACY_LEVELS.BALANCED);
    });

    it('should anonymize data based on privacy level', async () => {
      const sensitiveData = {
        email: 'user@example.com',
        filePath: '/home/user/secret/project.ts',
        errorMessage: 'Error in /home/user/project/file.ts at line 42'
      };

      const anonymized = await anonymizer.anonymizeData(sensitiveData, {
        category: DataCategory.PERSONAL_IDENTIFIER,
        privacyLevel: PRIVACY_LEVELS.STRICT
      });

      expect(anonymized).toBeDefined();
      // Strict mode should heavily anonymize data
      expect(anonymized.email).not.toBe(sensitiveData.email);
    });

    it('should generate consistent machine IDs', async () => {
      const id1 = await anonymizer.generateMachineId();
      const id2 = await anonymizer.generateMachineId();
      
      expect(id1).toBe(id2); // Should be consistent
      expect(id1).toMatch(/^[a-f0-9]{16}$/); // Should be hexadecimal hash
    });

    it('should hash user IDs', async () => {
      const machineId = 'test-machine-id';
      const hashedId = await anonymizer.hashUserId(machineId);
      
      expect(hashedId).toBeDefined();
      expect(hashedId).not.toBe(machineId);
      expect(hashedId).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should update privacy level', async () => {
      await anonymizer.updatePrivacyLevel(PRIVACY_LEVELS.STRICT);
      
      const stats = await anonymizer.getStatistics();
      expect(stats.privacyLevel).toBe(PRIVACY_LEVELS.STRICT);
    });

    it('should handle different data types correctly', async () => {
      const testData = {
        string: 'sensitive information',
        number: 42,
        boolean: true,
        date: new Date(),
        array: ['item1', 'item2', 'item3'],
        object: { nested: 'value', deep: { property: 'test' } },
        null: null,
        undefined: undefined
      };

      const anonymized = await anonymizer.anonymizeData(testData, {
        preserveStructure: true
      });

      expect(typeof anonymized.string).toBe('string');
      expect(typeof anonymized.number).toBe('number');
      expect(typeof anonymized.boolean).toBe('boolean');
      expect(Array.isArray(anonymized.array)).toBe(true);
      expect(typeof anonymized.object).toBe('object');
      expect(anonymized.null).toBeNull();
      expect(anonymized.undefined).toBeUndefined();
    });

    it('should apply different anonymization strategies', async () => {
      const strictAnonymizer = new PrivacyRespectingDataAnonymizer({
        privacyLevel: PRIVACY_LEVELS.STRICT
      });
      await strictAnonymizer.initialize();

      const balancedAnonymizer = new PrivacyRespectingDataAnonymizer({
        privacyLevel: PRIVACY_LEVELS.BALANCED
      });
      await balancedAnonymizer.initialize();

      const permissiveAnonymizer = new PrivacyRespectingDataAnonymizer({
        privacyLevel: PRIVACY_LEVELS.PERMISSIVE
      });
      await permissiveAnonymizer.initialize();

      const testData = { sensitiveField: 'this is sensitive information that should be handled differently' };

      const strictResult = await strictAnonymizer.anonymizeData(testData);
      const balancedResult = await balancedAnonymizer.anonymizeData(testData);
      const permissiveResult = await permissiveAnonymizer.anonymizeData(testData);

      // Strict should be most restrictive
      expect(strictResult.sensitiveField).not.toBe(testData.sensitiveField);
      
      // Permissive should preserve more data
      expect(permissiveResult.sensitiveField).toBe(testData.sensitiveField);

      await strictAnonymizer.shutdown();
      await balancedAnonymizer.shutdown();
      await permissiveAnonymizer.shutdown();
    });

    it('should handle file path anonymization', async () => {
      const filePaths = [
        '/home/user/documents/secret.ts',
        'C:\\Users\\John\\Desktop\\project\\main.js',
        './src/components/UserProfile.tsx'
      ];

      for (const path of filePaths) {
        const anonymized = await anonymizer.anonymizeData(path, {
          category: DataCategory.FILE_PATH,
          privacyLevel: PRIVACY_LEVELS.BALANCED
        });

        expect(anonymized).toBeDefined();
        expect(typeof anonymized).toBe('string');
      }
    });

    it('should handle error message anonymization', async () => {
      const errorMessages = [
        'Error in /home/user/project.ts: Cannot read property of undefined',
        'TypeError: user@example.com is not authorized',
        'Failed to connect to 192.168.1.1:3000'
      ];

      for (const message of errorMessages) {
        const anonymized = await anonymizer.anonymizeData(message, {
          category: DataCategory.ERROR_MESSAGE,
          privacyLevel: PRIVACY_LEVELS.BALANCED
        });

        expect(anonymized).toBeDefined();
        expect(typeof anonymized).toBe('string');
        // Should not contain personal information
        expect(anonymized).not.toContain('@example.com');
        expect(anonymized).not.toContain('192.168.1.1');
      }
    });

    it('should provide anonymization statistics', async () => {
      const stats = await anonymizer.getStatistics();
      
      expect(stats).toHaveProperty('privacyLevel');
      expect(stats).toHaveProperty('rulesCount');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('averageReduction');
      
      expect(stats.privacyLevel).toBe(PRIVACY_LEVELS.BALANCED);
      expect(typeof stats.rulesCount).toBe('number');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAnonymizer = new PrivacyRespectingDataAnonymizer();
      
      await expect(uninitializedAnonymizer.anonymizeData({}))
        .rejects.toThrow('not initialized');
      
      await expect(uninitializedAnonymizer.generateMachineId())
        .rejects.toThrow('not initialized');
    });
  });

  describe('Integration Tests', () => {
    it('should work together - consent manager and anonymizer', async () => {
      const consentManager = new PrivacyRespectingConsentManager(
        DEFAULT_TELEMETRY_CONFIG,
        '1.0.0',
        '1.0.0'
      );
      
      const anonymizer = new PrivacyRespectingDataAnonymizer();

      await consentManager.initialize();
      await anonymizer.initialize();

      // Set consent
      await consentManager.setConsent(true, '1.0.0');
      const status = await consentManager.getConsentStatus();
      
      // Use consent settings to configure anonymizer
      if (status.privacyLevel) {
        await anonymizer.updatePrivacyLevel(status.privacyLevel);
      }

      // Anonymize some test data
      const testData = { userId: 'test123', action: 'file_analyze' };
      const anonymized = await anonymizer.anonymizeData(testData);

      expect(anonymized).toBeDefined();
      expect(status.hasConsent).toBe(true);

      await consentManager.shutdown();
      await anonymizer.shutdown();
    });
  });
});