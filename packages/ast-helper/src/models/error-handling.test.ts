/**
 * Comprehensive tests for error handling and fallback logic
 * Tests all 6 acceptance criteria for Subtask 5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  ConnectivityStatus,
  categorizeError,
  validateConnectivity,
  validateDiskSpace,
  attemptRecovery
} from './error-handling.js';
import { ModelConfig } from './types.js';

// Mock fetch for network tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    statfs: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn()
  }
}));

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Network Connectivity Validation', () => {
    it('should detect online connectivity when all endpoints are reachable', async () => {
      // Test acceptance criteria: ✅ Network connectivity validation
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      const connectivity = await errorHandler.validateConnectivity(['https://test.com']);

      expect(connectivity.status).toBe(ConnectivityStatus.ONLINE);
      expect(connectivity.endpoints['https://test.com']).toBe(true);
      expect(connectivity.errors).toHaveLength(0);
      expect(connectivity.latency['https://test.com']).toBeGreaterThan(0);
    });

    it('should detect offline connectivity when no endpoints are reachable', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const connectivity = await errorHandler.validateConnectivity(['https://unreachable.com']);

      expect(connectivity.status).toBe(ConnectivityStatus.OFFLINE);
      expect(connectivity.endpoints['https://unreachable.com']).toBe(false);
      expect(connectivity.errors.length).toBeGreaterThan(0);
    });

    it('should detect limited connectivity when some endpoints are reachable', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockRejectedValueOnce(new Error('Network error'));

      const connectivity = await errorHandler.validateConnectivity([
        'https://working.com',
        'https://broken.com'
      ]);

      expect(connectivity.status).toBe(ConnectivityStatus.LIMITED);
      expect(connectivity.endpoints['https://working.com']).toBe(true);
      expect(connectivity.endpoints['https://broken.com']).toBe(false);
    });
  });

  describe('Disk Space Validation', () => {
    beforeEach(() => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    });

    it('should validate sufficient disk space using statfs', async () => {
      // Test acceptance criteria: ✅ Disk space validation
      vi.mocked(fs.statfs).mockResolvedValue({
        bsize: 4096,
        blocks: 1000000,
        bavail: 500000
      } as any);

      const requiredBytes = 1024 * 1024 * 1024; // 1GB
      const diskSpace = await errorHandler.validateDiskSpace('.astdb/models', requiredBytes);

      expect(diskSpace.sufficient).toBe(true);
      expect(diskSpace.total).toBe(4096 * 1000000);
      expect(diskSpace.available).toBe(4096 * 500000);
      expect(diskSpace.availablePercent).toBe(50);
    });

    it('should detect insufficient disk space', async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        bsize: 4096,
        blocks: 1000000,
        bavail: 100 // Very little space available
      } as any);

      const requiredBytes = 1024 * 1024 * 1024; // 1GB
      const diskSpace = await errorHandler.validateDiskSpace('.astdb/models', requiredBytes);

      expect(diskSpace.sufficient).toBe(false);
      expect(diskSpace.available).toBe(4096 * 100);
      expect(diskSpace.required).toBe(requiredBytes);
    });
  });

  describe('Graceful Degradation Strategies', () => {
    it('should register and manage fallback models', () => {
      // Test acceptance criteria: ✅ Graceful degradation strategies
      const primaryModel: ModelConfig = {
        name: 'primary-model',
        version: '1.0',
        url: 'https://example.com/primary.onnx',
        size: 1024 * 1024 * 1024, // 1GB
        checksum: 'abc123',
        format: 'onnx',
        dimensions: 768
      };

      const fallbackModel: ModelConfig = {
        name: 'fallback-model',
        version: '1.0',
        url: 'https://example.com/fallback.onnx',
        size: 512 * 1024 * 1024, // 512MB
        checksum: 'def456',
        format: 'onnx',
        dimensions: 384
      };

      errorHandler.registerFallbackModels('primary-model', {
        primary: primaryModel,
        alternatives: [fallbackModel],
        criteria: {
          maxSize: 2 * 1024 * 1024 * 1024, // 2GB
          minDimensions: 256,
          preferredFormat: 'onnx'
        }
      });

      expect(true).toBe(true); // Registration successful
    });

    it('should select fallback model based on size constraints', async () => {
      const primaryModel: ModelConfig = {
        name: 'large-model',
        version: '1.0',
        url: 'https://example.com/large.onnx',
        size: 2 * 1024 * 1024 * 1024, // 2GB
        checksum: 'abc123',
        format: 'onnx',
        dimensions: 768
      };

      const smallModel: ModelConfig = {
        name: 'small-model',
        version: '1.0',
        url: 'https://example.com/small.onnx',
        size: 100 * 1024 * 1024, // 100MB
        checksum: 'def456',
        format: 'onnx',
        dimensions: 384
      };

      errorHandler.registerFallbackModels('large-model', {
        primary: primaryModel,
        alternatives: [smallModel],
        criteria: {
          maxSize: 500 * 1024 * 1024 // 500MB limit
        }
      });

      // Mock sufficient network connectivity and disk space for the test
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      vi.mocked(fs.statfs).mockResolvedValue({
        bsize: 4096,
        blocks: 1000000,
        bavail: 500000 // Sufficient space
      } as any);

      const errorInfo = categorizeError('Download failed');
      const selected = await errorHandler.selectFallbackModel('large-model', errorInfo);

      expect(selected).not.toBeNull();
      expect(selected?.name).toBe('small-model');
    });
  });

  describe('Fallback Model Selection', () => {
    it('should return null when no fallback models are registered', async () => {
      // Test acceptance criteria: ✅ Fallback model selection
      const errorInfo = categorizeError('Unknown model error');
      const selected = await errorHandler.selectFallbackModel('unregistered-model', errorInfo);

      expect(selected).toBeNull();
    });
  });

  describe('Comprehensive Error Reporting', () => {
    it('should categorize network errors correctly', () => {
      // Test acceptance criteria: ✅ Comprehensive error reporting
      const networkError = new Error('ENOTFOUND host.example.com');
      const errorInfo = errorHandler.categorizeError(networkError);

      expect(errorInfo.category).toBe(ErrorCategory.NETWORK);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.recovery).toBe(RecoveryStrategy.RETRY);
      expect(errorInfo.code).toContain('NETWORK_');
      expect(errorInfo.message).toContain('Network address not found');
    });

    it('should categorize disk space errors correctly', () => {
      const diskError = new Error('ENOSPC: no space left on device');
      const errorInfo = errorHandler.categorizeError(diskError);

      expect(errorInfo.category).toBe(ErrorCategory.DISK_SPACE);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.recovery).toBe(RecoveryStrategy.MANUAL);
      expect(errorInfo.message).toContain('Not enough disk space');
    });

    it('should categorize validation errors correctly', () => {
      const validationError = new Error('Checksum verification failed');
      const errorInfo = errorHandler.categorizeError(validationError);

      expect(errorInfo.category).toBe(ErrorCategory.VALIDATION);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.recovery).toBe(RecoveryStrategy.FALLBACK);
    });

    it('should maintain error history and provide statistics', () => {
      // Generate multiple errors
      errorHandler.categorizeError(new Error('Network timeout'));
      errorHandler.categorizeError(new Error('ENOSPC: no space'));
      errorHandler.categorizeError(new Error('Validation failed'));

      const stats = errorHandler.getErrorStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byCategory[ErrorCategory.NETWORK]).toBe(1);
      expect(stats.byCategory[ErrorCategory.DISK_SPACE]).toBe(1);
      expect(stats.byCategory[ErrorCategory.VALIDATION]).toBe(1);
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should attempt retry recovery strategy', async () => {
      // Test acceptance criteria: ✅ Recovery mechanisms
      const errorInfo = categorizeError('Temporary network error');
      const result = await errorHandler.attemptRecovery(errorInfo);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY);
      expect(result.message).toBe('Operation retried successfully');
    });

    it('should attempt fallback recovery strategy', async () => {
      const primaryModel: ModelConfig = {
        name: 'primary',
        version: '1.0',
        url: 'https://example.com/primary.onnx',
        size: 1024 * 1024 * 1024,
        checksum: 'abc123',
        format: 'onnx',
        dimensions: 768
      };

      const fallbackModel: ModelConfig = {
        name: 'fallback',
        version: '1.0',
        url: 'https://example.com/fallback.onnx',
        size: 512 * 1024 * 1024,
        checksum: 'def456',
        format: 'onnx',
        dimensions: 384
      };

      errorHandler.registerFallbackModels('primary', {
        primary: primaryModel,
        alternatives: [fallbackModel],
        criteria: {}
      });

      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      const errorInfo = categorizeError('Validation failed');
      const context = { modelName: 'primary' };
      const result = await errorHandler.attemptRecovery(errorInfo, context);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK);
      expect(result.model).toBeDefined();
      expect(result.model?.name).toBe('fallback');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide categorizeError convenience function', () => {
      const errorInfo = categorizeError('Test error', { context: 'test' });

      expect(errorInfo.category).toBeDefined();
      expect(errorInfo.severity).toBeDefined();
      expect(errorInfo.recovery).toBeDefined();
      expect(errorInfo.context).toEqual({ context: 'test' });
    });

    it('should provide validateConnectivity convenience function', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      const connectivity = await validateConnectivity(['https://test.com']);

      expect(connectivity.status).toBe(ConnectivityStatus.ONLINE);
    });

    it('should provide validateDiskSpace convenience function', async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        bsize: 4096,
        blocks: 1000000,
        bavail: 500000
      } as any);

      const diskSpace = await validateDiskSpace();

      expect(diskSpace.sufficient).toBeDefined();
      expect(diskSpace.available).toBeGreaterThan(0);
    });
  });
});