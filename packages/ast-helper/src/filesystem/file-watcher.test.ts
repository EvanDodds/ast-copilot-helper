/**
 * File watcher types and interface tests
 * Tests for file watching system type definitions and basic functionality
 */

import { describe, it, expect } from 'vitest';
import type { 
  FileWatchConfig, 
  FileChangeEvent, 
  WatchStats, 
  FileWatcher,
  IncrementalUpdateManager,
  ConsistencyReport 
} from './types.js';

describe('File Watcher Types', () => {
  describe('FileWatchConfig', () => {
    it('should define required configuration properties', () => {
      const config: FileWatchConfig = {
        watchPaths: ['/src'],
        includePatterns: ['*.ts', '*.js'],
        excludePatterns: ['node_modules/**'],
        debounceMs: 1000,
        batchSize: 50,
        enableRecursive: true,
        followSymlinks: false
      };

      expect(config.watchPaths).toEqual(['/src']);
      expect(config.includePatterns).toEqual(['*.ts', '*.js']);
      expect(config.excludePatterns).toEqual(['node_modules/**']);
      expect(config.debounceMs).toBe(1000);
      expect(config.batchSize).toBe(50);
      expect(config.enableRecursive).toBe(true);
      expect(config.followSymlinks).toBe(false);
    });
  });

  describe('FileChangeEvent', () => {
    it('should define file change event properties', () => {
      const event: FileChangeEvent = {
        type: 'change',
        filePath: '/src/test.ts',
        timestamp: new Date('2024-01-01T00:00:00Z')
      };

      expect(event.type).toBe('change');
      expect(event.filePath).toBe('/src/test.ts');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should support all event types', () => {
      const eventTypes: FileChangeEvent['type'][] = [
        'add', 'change', 'unlink', 'addDir', 'unlinkDir'
      ];

      eventTypes.forEach(type => {
        const event: FileChangeEvent = {
          type,
          filePath: '/test',
          timestamp: new Date()
        };
        expect(event.type).toBe(type);
      });
    });
  });

  describe('WatchStats', () => {
    it('should define statistics properties', () => {
      const stats: WatchStats = {
        watchedFiles: 100,
        totalEvents: 500,
        processedChanges: 450,
        lastProcessedAt: new Date('2024-01-01T00:00:00Z'),
        averageProcessingTime: 25.5
      };

      expect(stats.watchedFiles).toBe(100);
      expect(stats.totalEvents).toBe(500);
      expect(stats.processedChanges).toBe(450);
      expect(stats.lastProcessedAt).toBeInstanceOf(Date);
      expect(stats.averageProcessingTime).toBe(25.5);
    });
  });

  describe('ConsistencyReport', () => {
    it('should define consistency report properties', () => {
      const report: ConsistencyReport = {
        inconsistentFiles: ['/src/broken.ts'],
        orphanedVectors: ['vector-123'],
        missingVectors: ['/src/missing.ts'],
        totalChecked: 100,
        issuesFound: 2
      };

      expect(report.inconsistentFiles).toEqual(['/src/broken.ts']);
      expect(report.orphanedVectors).toEqual(['vector-123']);
      expect(report.missingVectors).toEqual(['/src/missing.ts']);
      expect(report.totalChecked).toBe(100);
      expect(report.issuesFound).toBe(2);
    });
  });
});

describe('Interface Contracts', () => {
  it('should define FileWatcher interface methods', () => {
    // Test that FileWatcher interface exists with expected methods
    const methods: (keyof FileWatcher)[] = [
      'initialize',
      'start',
      'stop',
      'addWatchPath',
      'removeWatchPath',
      'getWatchedPaths',
      'getWatchStats'
    ];

    // This test verifies interface structure exists
    // Implementation tests will be added when classes are implemented
    expect(methods).toHaveLength(7);
    expect(methods).toContain('initialize');
    expect(methods).toContain('start');
    expect(methods).toContain('stop');
  });

  it('should define IncrementalUpdateManager interface methods', () => {
    const methods: (keyof IncrementalUpdateManager)[] = [
      'shouldFullReparse',
      'optimizeUpdateBatch',
      'validateIndexConsistency'
    ];

    expect(methods).toHaveLength(3);
    expect(methods).toContain('shouldFullReparse');
    expect(methods).toContain('optimizeUpdateBatch');
    expect(methods).toContain('validateIndexConsistency');
  });
});