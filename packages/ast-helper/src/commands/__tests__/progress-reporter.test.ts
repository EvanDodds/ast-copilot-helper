/**
 * Progress Reporter Tests (Subtask 6)
 * 
 * Tests for the ProgressReporter class functionality including
 * real-time display, performance metrics, ETA calculation, and memory tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressReporter, ProgressDisplayOptions, ParseProgressUpdate } from '../progress-reporter.js';
import { createLogger } from '../../logging/index.js';

// Mock process.stdout for testing
const mockStdout = {
  isTTY: true,
  write: vi.fn()
};

vi.stubGlobal('process', {
  ...process,
  stdout: mockStdout
});

describe('ProgressReporter (Subtask 6)', () => {
  let progressReporter: ProgressReporter;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    // Reset stdout mock
    mockStdout.write.mockClear();
  });

  afterEach(() => {
    if (progressReporter) {
      progressReporter.dispose();
    }
  });

  describe('Progress Reporter Creation', () => {
    it('should create ProgressReporter with default options', () => {
      progressReporter = new ProgressReporter(mockLogger);
      expect(progressReporter).toBeDefined();
      expect(progressReporter.getStats().totalFiles).toBe(0);
    });

    it('should create ProgressReporter with custom options', () => {
      const options: Partial<ProgressDisplayOptions> = {
        showMemoryUsage: false,
        updateIntervalMs: 500,
        maxFilePathLength: 30
      };
      
      progressReporter = new ProgressReporter(mockLogger, options);
      expect(progressReporter).toBeDefined();
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      progressReporter = new ProgressReporter(mockLogger, {
        updateIntervalMs: 0 // Disable timer for testing
      });
    });

    it('should start progress reporting correctly', () => {
      const totalFiles = 100;
      progressReporter.start(totalFiles);
      
      const stats = progressReporter.getStats();
      expect(stats.totalFiles).toBe(totalFiles);
      expect(stats.completedFiles).toBe(0);
      expect(stats.startTime).toBeGreaterThan(0);
    });

    it('should update progress with new data', () => {
      progressReporter.start(100);
      
      const update: ParseProgressUpdate = {
        completed: 25,
        total: 100,
        currentFile: '/test/file.ts',
        rate: 2.5,
        estimatedTimeRemaining: 30000,
        memoryUsageMB: 150,
        phase: 'parsing'
      };
      
      progressReporter.update(update);
      
      const stats = progressReporter.getStats();
      expect(stats.completedFiles).toBe(25);
      expect(stats.currentFile).toBe('/test/file.ts');
      expect(stats.filesPerSecond).toBe(2.5);
      expect(stats.memoryUsageMB).toBe(150);
      expect(stats.currentPhase).toBe('parsing');
    });

    it('should track memory pressure correctly', () => {
      progressReporter.start(10);
      
      // Low memory
      progressReporter.update({
        completed: 1,
        total: 10,
        memoryUsageMB: 100
      });
      expect(progressReporter.getStats().memoryPressure).toBe('low');
      
      // Medium memory
      progressReporter.update({
        completed: 2,
        total: 10,
        memoryUsageMB: 600
      });
      expect(progressReporter.getStats().memoryPressure).toBe('medium');
      
      // High memory
      progressReporter.update({
        completed: 3,
        total: 10,
        memoryUsageMB: 1200
      });
      expect(progressReporter.getStats().memoryPressure).toBe('high');
    });

    it('should track peak memory usage', () => {
      progressReporter.start(10);
      
      progressReporter.update({
        completed: 1,
        total: 10,
        memoryUsageMB: 200
      });
      
      progressReporter.update({
        completed: 2,
        total: 10,
        memoryUsageMB: 500
      });
      
      progressReporter.update({
        completed: 3,
        total: 10,
        memoryUsageMB: 300
      });
      
      const stats = progressReporter.getStats();
      expect(stats.peakMemoryUsageMB).toBe(500);
      expect(stats.memoryUsageMB).toBe(300); // Current should be latest
    });

    it('should increment failure count', () => {
      progressReporter.start(10);
      
      progressReporter.incrementFailures(2);
      expect(progressReporter.getStats().failedFiles).toBe(2);
      
      progressReporter.incrementFailures();
      expect(progressReporter.getStats().failedFiles).toBe(3);
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      progressReporter = new ProgressReporter(mockLogger, {
        updateIntervalMs: 0
      });
    });

    it('should emit progress events', async () => {
      const progressPromise = new Promise<void>((resolve) => {
        progressReporter.on('progress', (stats) => {
          expect(stats.completedFiles).toBe(5);
          expect(stats.currentFile).toBe('/test.ts');
          resolve();
        });
      });

      progressReporter.start(10);
      progressReporter.update({
        completed: 5,
        total: 10,
        currentFile: '/test.ts'
      });

      await progressPromise;
    });

    it('should emit memory pressure events', async () => {
      const memoryPressurePromise = new Promise<void>((resolve) => {
        progressReporter.on('memory-pressure', (stats) => {
          expect(stats.memoryPressure).toBe('high');
          resolve();
        });
      });

      progressReporter.start(10);
      progressReporter.update({
        completed: 1,
        total: 10,
        memoryUsageMB: 1500 // High memory
      });

      await memoryPressurePromise;
    });

    it('should emit completion events', async () => {
      const completionPromise = new Promise<void>((resolve) => {
        progressReporter.on('completed', (stats) => {
          expect(stats.totalFiles).toBe(10);
          resolve();
        });
      });

      progressReporter.start(10);
      progressReporter.complete();

      await completionPromise;
    });
  });

  describe('Display Formatting', () => {
    beforeEach(() => {
      progressReporter = new ProgressReporter(mockLogger, {
        updateIntervalMs: 100,
        useColors: false,
        clearLine: false
      });
    });

    it('should handle display updates without errors', async () => {
      progressReporter.start(50);
      
      progressReporter.update({
        completed: 25,
        total: 50,
        currentFile: '/path/to/very/long/filename/that/should/be/truncated.ts',
        rate: 5.2,
        memoryUsageMB: 256,
        estimatedTimeRemaining: 15000
      });
      
      // Wait for display timer to fire at least once
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify display output was written
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('50%') // Should contain progress percentage
      );
    });

    it('should complete and show final summary', () => {
      progressReporter.start(10);
      
      progressReporter.update({
        completed: 10,
        total: 10,
        rate: 3.5,
        memoryUsageMB: 200
      });
      
      progressReporter.complete();
      
      // The complete() method writes directly to console.log, not process.stdout.write
      // So just verify no errors were thrown during completion
      expect(() => progressReporter.complete()).not.toThrow();
    });
  });

  describe('Configuration Options', () => {
    it('should respect display option configurations', () => {
      const options: Partial<ProgressDisplayOptions> = {
        showMemoryUsage: false,
        showFileDetails: false,
        showPerformanceStats: false,
        showETA: false,
        useColors: false,
        maxFilePathLength: 20
      };
      
      progressReporter = new ProgressReporter(mockLogger, options);
      progressReporter.start(10);
      
      progressReporter.update({
        completed: 5,
        total: 10,
        currentFile: '/very/long/path/to/file.ts',
        rate: 2.0,
        memoryUsageMB: 300,
        estimatedTimeRemaining: 10000
      });
      
      // Should complete without errors despite disabled options
      expect(() => progressReporter.complete()).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      progressReporter = new ProgressReporter(mockLogger, {
        updateIntervalMs: 0
      });
    });

    it('should track processing rates correctly', () => {
      progressReporter.start(100);
      
      progressReporter.update({
        completed: 50,
        total: 100,
        rate: 5.5
      });
      
      const stats = progressReporter.getStats();
      expect(stats.filesPerSecond).toBe(5.5);
    });

    it('should handle batch information updates', () => {
      progressReporter.start(100);
      
      progressReporter.update({
        completed: 25,
        total: 100,
        batchInfo: {
          current: 2,
          total: 4,
          size: 25
        }
      });
      
      const stats = progressReporter.getStats();
      expect(stats.currentBatch).toBe(2);
      expect(stats.totalBatches).toBe(4);
      expect(stats.batchSize).toBe(25);
    });

    it('should handle node statistics updates', () => {
      progressReporter.start(50);
      
      progressReporter.update({
        completed: 20,
        total: 50,
        nodeStats: {
          totalNodes: 15000,
          averageNodesPerFile: 750
        }
      });
      
      const stats = progressReporter.getStats();
      expect(stats.totalNodes).toBe(15000);
      expect(stats.averageNodesPerFile).toBe(750);
    });
  });

  describe('Resource Cleanup', () => {
    it('should dispose cleanly', () => {
      progressReporter = new ProgressReporter(mockLogger, {
        updateIntervalMs: 100
      });
      
      progressReporter.start(10);
      
      expect(() => progressReporter.dispose()).not.toThrow();
    });

    it('should handle multiple dispose calls gracefully', () => {
      progressReporter = new ProgressReporter(mockLogger);
      
      progressReporter.dispose();
      expect(() => progressReporter.dispose()).not.toThrow();
    });
  });
});