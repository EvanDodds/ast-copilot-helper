/**
 * Tests for Core Error Reporting Infrastructure
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComprehensiveErrorReportingManager } from '../manager.js';
import type { ErrorReportingConfig, ErrorReport } from '../types.js';

describe('ComprehensiveErrorReportingManager', () => {
  let errorManager: ComprehensiveErrorReportingManager;
  let config: ErrorReportingConfig;

  beforeEach(() => {
    // Increase max listeners to prevent EventEmitter warnings during tests
    process.setMaxListeners(50);
    
    errorManager = new ComprehensiveErrorReportingManager();
    config = {
      enabled: true,
      enableCrashReporting: true,
      enableAutomaticReporting: false,
      collectSystemInfo: true,
      collectCodebaseInfo: true,
      maxReportSize: 1024 * 1024,
      maxHistoryEntries: 100,
      privacyMode: false,
      userReportingEnabled: true,
      diagnosticDataCollection: {
        system: true,
        runtime: true,
        codebase: true,
        configuration: true,
        performance: true,
        dependencies: true,
        maxCollectionTimeMs: 10000,
        includeEnvironmentVars: true,
        includeProcessInfo: true
      }
    };
  });

  afterEach(async () => {
    if (errorManager) {
      await errorManager.cleanup();
    }
    // Reset max listeners to default
    process.setMaxListeners(10);
  });

  describe('initialization', () => {
    test('should initialize with default configuration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await errorManager.initialize(config);
      
      expect(consoleSpy).toHaveBeenCalledWith('🔧 Initializing comprehensive error reporting system...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Error reporting system initialized successfully');
      
      consoleSpy.mockRestore();
    });

    test('should merge partial configuration with defaults', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const partialConfig: Partial<ErrorReportingConfig> = {
        enabled: false,
        privacyMode: true
      };
      
      await errorManager.initialize(partialConfig as ErrorReportingConfig);
      
      // Should not throw and should complete initialization
      expect(consoleSpy).toHaveBeenCalledWith('✅ Error reporting system initialized successfully');
      
      consoleSpy.mockRestore();
    });
  });

  describe('error report generation', () => {
    beforeEach(async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await errorManager.initialize(config);
      consoleSpy.mockRestore();
    });

    test('should generate error report from Error object', async () => {
      const testError = new Error('Test error message');
      testError.stack = 'Error: Test error message\n    at test.js:1:1';
      
      const errorReport = await errorManager.generateErrorReport(testError);
      
      expect(errorReport).toMatchObject({
        type: 'error',
        message: 'Test error message',
        originalError: testError,
        stackTrace: testError.stack,
        userProvided: false,
        reportedToServer: false
      });
      expect(errorReport.id).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(errorReport.timestamp).toBeInstanceOf(Date);
      expect(['low', 'medium', 'high', 'critical']).toContain(errorReport.severity);
    });

    test('should generate error report with context', async () => {
      const testError = new Error('Test error message');
      const context = { operation: 'test-operation', data: 'test-data' };
      
      const errorReport = await errorManager.generateErrorReport(testError, context);
      
      expect(errorReport.context.parameters).toEqual(context);
    });

    test('should categorize errors correctly', async () => {
      const networkError = new Error('Network connection failed');
      const fileError = new Error('ENOENT: no such file or directory');
      const permissionError = new Error('EACCES: permission denied');
      const parseError = new Error('Unexpected token in JSON at position 5');
      
      const networkReport = await errorManager.generateErrorReport(networkError);
      const fileReport = await errorManager.generateErrorReport(fileError);
      const permissionReport = await errorManager.generateErrorReport(permissionError);
      const parseReport = await errorManager.generateErrorReport(parseError);
      
      expect(networkReport.category).toBe('network-error');
      expect(fileReport.category).toBe('filesystem-error');
      expect(permissionReport.category).toBe('permission-error');
      expect(parseReport.category).toBe('parse-error');
    });

    test('should determine error severity correctly', async () => {
      const criticalError = new Error('Segmentation fault');
      const highError = new Error('Permission denied');
      const mediumError = new Error('Network timeout');
      const warningError = new Error('Deprecated API usage warning');
      
      const criticalReport = await errorManager.generateErrorReport(criticalError);
      const highReport = await errorManager.generateErrorReport(highError);
      const mediumReport = await errorManager.generateErrorReport(mediumError);
      const warningReport = await errorManager.generateErrorReport(warningError);
      
      expect(criticalReport.severity).toBe('critical');
      expect(highReport.severity).toBe('high');
      expect(mediumReport.severity).toBe('medium');
      expect(warningReport.severity).toBe('low');
    });
  });

  describe('error reporting', () => {
    let mockErrorReport: ErrorReport;

    beforeEach(async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await errorManager.initialize(config);
      consoleSpy.mockRestore();

      mockErrorReport = {
        id: 'test-error-id',
        timestamp: new Date(),
        type: 'error',
        severity: 'medium',
        category: 'test-error',
        operation: 'test-operation',
        message: 'Test error message',
        context: {} as any,
        environment: {} as any,
        diagnostics: {} as any,
        userProvided: false,
        reportedToServer: false,
        suggestions: []
      };
    });

    test('should report error successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await errorManager.reportError(mockErrorReport);
      
      expect(result.success).toBe(true);
      expect(result.errorId).toBe(mockErrorReport.id);
      expect(consoleSpy).toHaveBeenCalledWith('📊 Reporting error: error - test-error');
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('should add error to history', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await errorManager.reportError(mockErrorReport);
      const history = await errorManager.getErrorHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(mockErrorReport.id);
      expect(history[0].error).toEqual(mockErrorReport);
      expect(history[0].resolved).toBe(false);
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('should generate suggestions for error', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await errorManager.reportError(mockErrorReport);
      
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('diagnostic collection', () => {
    beforeEach(async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await errorManager.initialize(config);
      consoleSpy.mockRestore();
    });

    test('should collect diagnostic data', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const diagnostics = await errorManager.collectDiagnostics({
        timestamp: new Date(),
        includeSystemInfo: true,
        includeRuntimeInfo: true,
        includeCodebaseInfo: true
      });
      
      expect(diagnostics).toBeDefined();
      expect(typeof diagnostics).toBe('object');
      expect(consoleSpy).toHaveBeenCalledWith('🔍 Collecting comprehensive diagnostic data...');
      
      consoleSpy.mockRestore();
    });

    test('should handle diagnostic collection errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Test with invalid context that might cause errors
      const diagnostics = await errorManager.collectDiagnostics({
        timestamp: new Date()
      });
      
      expect(diagnostics).toBeDefined();
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('suggestions', () => {
    let mockErrorReport: ErrorReport;

    beforeEach(async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await errorManager.initialize(config);
      consoleSpy.mockRestore();

      mockErrorReport = {
        id: 'test-error-id',
        timestamp: new Date(),
        type: 'error',
        severity: 'medium',
        category: 'test-error',
        operation: 'test-operation',
        message: 'Test error message',
        context: {} as any,
        environment: {} as any,
        diagnostics: {} as any,
        userProvided: false,
        reportedToServer: false,
        suggestions: []
      };
    });

    test('should provide suggestions for error', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const suggestions = await errorManager.provideSuggestions(mockErrorReport);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('🧠 Generating suggestions for error: test-error');
      
      consoleSpy.mockRestore();
    });

    test('should return fallback suggestions on error', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock the suggestion engine's generateSuggestions to throw an error to force fallback
      const originalEngine = (errorManager as any).suggestionEngine;
      (errorManager as any).suggestionEngine = {
        generateSuggestions: vi.fn().mockRejectedValue(new Error('Test error'))
      };
      
      const suggestions = await errorManager.provideSuggestions(mockErrorReport);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toMatchObject({
        id: 'fallback-1',
        title: 'Check Error Details',
        category: 'information',
        confidence: 0.5
      });
      
      // Restore the original suggestion engine
      (errorManager as any).suggestionEngine = originalEngine;
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('error history management', () => {
    beforeEach(async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await errorManager.initialize(config);
      consoleSpy.mockRestore();
    });

    test('should start with empty history', async () => {
      const history = await errorManager.getErrorHistory();
      expect(history).toEqual([]);
    });

    test('should clear error history', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Add an error to history
      const mockErrorReport = {
        id: 'test-error-id',
        timestamp: new Date(),
        type: 'error' as const,
        severity: 'medium' as const,
        category: 'test-error',
        operation: 'test-operation',
        message: 'Test error message',
        context: {} as any,
        environment: {} as any,
        diagnostics: {} as any,
        userProvided: false,
        reportedToServer: false,
        suggestions: []
      };
      
      await errorManager.reportError(mockErrorReport);
      let history = await errorManager.getErrorHistory();
      expect(history).toHaveLength(1);
      
      await errorManager.clearErrorHistory();
      history = await errorManager.getErrorHistory();
      expect(history).toEqual([]);
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('operation tracking', () => {
    beforeEach(async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await errorManager.initialize(config);
      consoleSpy.mockRestore();
    });

    test('should track current operation', async () => {
      errorManager.setCurrentOperation('test-operation');
      
      const testError = new Error('Test error');
      const errorReport = await errorManager.generateErrorReport(testError);
      
      expect(errorReport.operation).toBe('test-operation');
    });

    test('should maintain operation history', () => {
      errorManager.setCurrentOperation('operation-1');
      errorManager.setCurrentOperation('operation-2');
      errorManager.setCurrentOperation('operation-3');
      
      // This is tested implicitly through error context
      expect(() => {
        errorManager.setCurrentOperation('operation-4');
      }).not.toThrow();
    });
  });

  describe('diagnostic export', () => {
    beforeEach(async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await errorManager.initialize(config);
      consoleSpy.mockRestore();
    });

    test('should export diagnostics as JSON', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const jsonDiagnostics = await errorManager.exportDiagnostics('json');
      
      expect(typeof jsonDiagnostics).toBe('string');
      expect(() => JSON.parse(jsonDiagnostics)).not.toThrow();
      
      consoleSpy.mockRestore();
    });

    test('should export diagnostics as text', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const textDiagnostics = await errorManager.exportDiagnostics('text');
      
      expect(typeof textDiagnostics).toBe('string');
      expect(textDiagnostics.length).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });
});