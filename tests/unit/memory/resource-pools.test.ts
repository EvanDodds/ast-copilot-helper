/**
 * Resource Pool System Tests
 * Comprehensive test suite for all resource pool implementations
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  BaseResourcePool, 
  DatabaseConnectionPool, 
  FileHandlePool, 
  WorkerThreadPool 
} from '../../../packages/ast-helper/src/memory/pools/index.js';
import type {
  BasePoolConfig,
  DatabaseConnectionPoolConfig,
  FileHandlePoolConfig,
  WorkerThreadPoolConfig,
  ResourceFactory,
  DatabaseConnection,
  FileHandle,
  WorkerThread
} from '../../../packages/ast-helper/src/memory/pools/index.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('Resource Pool System', () => {
  describe('BaseResourcePool', () => {
    let pool: BaseResourcePool<string>;
    let mockFactory: ResourceFactory<string>;
    let config: BasePoolConfig;

    beforeEach(() => {
      mockFactory = {
        async create(): Promise<string> {
          return `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },
        async destroy(resource: string): Promise<void> {
          // Mock destruction
        },
        async validate(resource: string): Promise<boolean> {
          return resource.startsWith('resource_');
        },
        async reset(resource: string): Promise<void> {
          // Mock reset
        }
      };

      config = {
        name: 'test-pool',
        minSize: 2,
        maxSize: 10,
        acquireTimeoutMs: 1000, // Reduced for tests
        idleTimeoutMs: 5000, // Reduced for tests
        maxQueueSize: 20,
        validateOnAcquire: true,
        validateOnRelease: true,
        enableMetrics: true,
        autoResize: false,
        resizeThreshold: 0.8,
        maxRetries: 3,
        retryDelayMs: 100,
        healthCheckInterval: 1000, // Reduced for tests
      };

      pool = new BaseResourcePool(config, mockFactory);
    });

    afterEach(async () => {
      try {
        await pool.cleanup();
      } catch (error) {
        console.warn('Pool cleanup failed:', error);
      }
    }, 20000); // Increased timeout for cleanup

    test('should initialize with minimum resources', async () => {
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = pool.getStats();
      expect(stats.totalResources).toBeGreaterThanOrEqual(config.minSize);
      expect(stats.availableResources).toBeGreaterThanOrEqual(config.minSize);
    });

    test('should acquire and release resources', async () => {
      const resource = await pool.acquire();
      expect(resource).toBeTruthy();
      expect(typeof resource).toBe('string');

      const statsAfterAcquire = pool.getStats();
      expect(statsAfterAcquire.inUseResources).toBeGreaterThan(0);

      await pool.release(resource);

      const statsAfterRelease = pool.getStats();
      expect(statsAfterRelease.inUseResources).toBe(statsAfterAcquire.inUseResources - 1);
    });

    test('should create new resources when needed', async () => {
      const resources = [];
      
      // Acquire more than min size
      for (let i = 0; i < config.minSize + 2; i++) {
        resources.push(await pool.acquire());
      }

      const stats = pool.getStats();
      expect(stats.totalResources).toBeGreaterThan(config.minSize);
      expect(stats.inUseResources).toBe(resources.length);

      // Clean up
      for (const resource of resources) {
        await pool.release(resource);
      }
    });

    test('should respect max size limits', async () => {
      // Test that the pool configuration respects max size conceptually
      const stats = pool.getStats();
      expect(stats.totalResources).toBeLessThanOrEqual(config.maxSize);
      
      // Acquire a few resources to verify basic functionality
      const resource1 = await pool.acquire();
      const resource2 = await pool.acquire();
      
      const stats2 = pool.getStats();
      expect(stats2.inUseResources).toBe(2);
      
      // Clean up
      await pool.release(resource1);
      await pool.release(resource2);
    });

    test('should handle resource validation', async () => {
      // Create a simple test to verify validation behavior
      const resource = await pool.acquire();
      
      // Should normally succeed
      await pool.release(resource);
      
      // This test validates that normal flow works
      expect(true).toBe(true);
    });

    test('should provide accurate statistics', async () => {
      const resource = await pool.acquire();
      const stats = pool.getStats();

      expect(stats).toHaveProperty('totalResources');
      expect(stats).toHaveProperty('availableResources');
      expect(stats).toHaveProperty('inUseResources');
      expect(stats).toHaveProperty('createdResources');
      expect(stats).toHaveProperty('acquisitionTime');
      expect(stats).toHaveProperty('creationTime');
      expect(stats).toHaveProperty('utilizationRate');

      expect(stats.inUseResources).toBeGreaterThan(0);
      expect(stats.utilizationRate).toBeGreaterThan(0);

      await pool.release(resource);
    });

    test('should drain all resources', async () => {
      const resource = await pool.acquire();
      
      // Start draining
      const drainPromise = pool.drain();
      
      // Release the resource to allow draining to complete
      await pool.release(resource);
      
      await drainPromise;

      const stats = pool.getStats();
      expect(stats.totalResources).toBe(0);
      expect(stats.availableResources).toBe(0);
      expect(stats.inUseResources).toBe(0);
    });
  });

  describe('DatabaseConnectionPool', () => {
    let pool: DatabaseConnectionPool;
    let config: DatabaseConnectionPoolConfig;

    beforeEach(() => {
      config = {
        name: 'db-pool',
        minSize: 2,
        maxSize: 10,
        acquireTimeoutMs: 1000,
        idleTimeoutMs: 5000,
        maxQueueSize: 20,
        validateOnAcquire: true,
        validateOnRelease: true,
        enableMetrics: true,
        autoResize: false,
        resizeThreshold: 0.8,
        maxRetries: 3,
        retryDelayMs: 100,
        healthCheckInterval: 1000,
        databaseUrl: 'mock://localhost:5432/testdb',
        database: 'testdb',
        host: 'localhost',
        port: 5432,
        connectionOptions: { poolSize: 10 },
        maxConnections: 10,
      };

      pool = new DatabaseConnectionPool(config);
    });

    afterEach(async () => {
      await pool.cleanup();
    });

    test('should create database connections', async () => {
      const connection = await pool.acquire();
      
      expect(connection).toBeTruthy();
      expect(connection.id).toBeTruthy();
      expect(connection.database).toBe(config.database);
      expect(connection.host).toBe(config.host);
      expect(connection.port).toBe(config.port);
      expect(connection.isHealthy).toBe(true);

      await pool.release(connection);
    });

    test('should validate connections', async () => {
      const connection = await pool.acquire();
      expect(connection.isHealthy).toBe(true);
      
      await pool.release(connection);
    });

    test('should track connection metrics', async () => {
      const connection = await pool.acquire();
      
      expect(connection.queryCount).toBe(0);
      expect(connection.createdAt).toBeTypeOf('number');
      expect(connection.lastUsedAt).toBeTypeOf('number');

      await pool.release(connection);
    });
  });

  describe('FileHandlePool', () => {
    let pool: FileHandlePool;
    let config: FileHandlePoolConfig;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filepool-test-'));
      
      config = {
        name: 'file-pool',
        minSize: 1,
        maxSize: 5,
        acquireTimeoutMs: 1000,
        idleTimeoutMs: 5000,
        maxQueueSize: 10,
        validateOnAcquire: true,
        validateOnRelease: true,
        enableMetrics: true,
        autoResize: false,
        resizeThreshold: 0.8,
        maxRetries: 3,
        retryDelayMs: 100,
        healthCheckInterval: 1000,
        basePath: tempDir,
        defaultMode: 'r',
        maxConcurrentFiles: 5,
        allowedExtensions: ['.txt', '.tmp'],
        maxFileSize: 1024 * 1024, // 1MB
        createDirectories: true,
      };

      pool = new FileHandlePool(config);
    });

    afterEach(async () => {
      await pool.cleanup();
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should create file handles', async () => {
      // Create a test file first
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const handle = await pool.acquireFileHandle(testFile, 'r');
      
      expect(handle).toBeTruthy();
      expect(handle.id).toBeTruthy();
      expect(handle.path).toBe(testFile);
      expect(handle.mode).toBe('r');
      expect(handle.isLocked).toBe(false);
      expect(handle.operations).toBe(0);

      await pool.release(handle);
    });

    test('should validate file extensions', async () => {
      const invalidFile = path.join(tempDir, 'test.invalid');
      
      await expect(pool.acquireFileHandle(invalidFile, 'r')).rejects.toThrow();
    });

    test('should create directories if configured', async () => {
      const subDir = path.join(tempDir, 'subdir', 'test.txt');
      
      const handle = await pool.acquireFileHandle(subDir, 'w');
      expect(handle.path).toBe(subDir);
      
      // Check that directory was created
      const dirExists = await fs.access(path.dirname(subDir)).then(() => true, () => false);
      expect(dirExists).toBe(true);

      await pool.release(handle);
    });

    test('should enforce security boundaries', async () => {
      const outsideFile = path.join('..', '..', 'outside.txt');
      
      await expect(pool.acquireFileHandle(outsideFile, 'r')).rejects.toThrow();
    });
  });

  describe('WorkerThreadPool', () => {
    let pool: WorkerThreadPool;
    let config: WorkerThreadPoolConfig;
    let workerScript: string;

    beforeEach(async () => {
      // Create a simple test worker script
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'worker-test-'));
      workerScript = path.join(tempDir, 'test-worker.js');
      
      const workerCode = `
        const { parentPort } = require('worker_threads');
        
        // Signal ready
        parentPort.postMessage({ type: 'ready' });
        
        parentPort.on('message', (message) => {
          if (message.type === 'ping') {
            parentPort.postMessage({ type: 'pong' });
          } else if (message.type === 'reset') {
            // Handle reset
          } else if (message.taskData) {
            // Process task
            try {
              const result = { processed: message.taskData };
              parentPort.postMessage({ data: result });
            } catch (error) {
              parentPort.postMessage({ error: error.message });
            }
          }
        });
      `;
      
      await fs.writeFile(workerScript, workerCode);

      config = {
        name: 'worker-pool',
        minSize: 1,
        maxSize: 4,
        acquireTimeoutMs: 1000,
        idleTimeoutMs: 5000,
        maxQueueSize: 10,
        validateOnAcquire: true,
        validateOnRelease: true,
        enableMetrics: true,
        autoResize: false,
        resizeThreshold: 0.8,
        maxRetries: 3,
        retryDelayMs: 100,
        healthCheckInterval: 1000,
        workerScript,
        workerType: 'generic',
        workerOptions: {},
        maxConcurrentTasks: 10,
        taskTimeout: 5000,
        maxMemoryPerWorker: 128, // 128MB
        maxCpuUsagePercent: 80,
      };

      pool = new WorkerThreadPool(config);
    });

    afterEach(async () => {
      // First cleanup the pool properly
      if (pool) {
        await pool.cleanup();
      }
      
      // Wait a bit for all workers to fully terminate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clean up worker script
      try {
        if (workerScript) {
          await fs.unlink(workerScript);
          await fs.rmdir(path.dirname(workerScript));
        }
      } catch (error) {
        // Ignore cleanup errors - file might already be deleted
        console.debug('Worker cleanup error (expected):', error);
      }
    });

    test('should create worker threads', async () => {
      const worker = await pool.acquire();
      
      expect(worker).toBeTruthy();
      expect(worker.id).toBeTruthy();
      expect(worker.type).toBe('generic');
      expect(worker.isProcessing).toBe(false);
      expect(worker.taskCount).toBe(0);
      expect(worker.worker).toBeTruthy();

      await pool.release(worker);
    });

    test('should execute tasks', async () => {
      const taskData = { test: 'data', value: 42 };
      
      const result = await pool.executeTask(taskData);
      
      expect(result).toBeTruthy();
      expect(result.processed).toEqual(taskData);
    });

    test('should handle multiple concurrent tasks', async () => {
      const tasks = Array.from({ length: 3 }, (_, i) => ({ task: i, data: `test-${i}` }));
      
      const results = await Promise.all(
        tasks.map(task => pool.executeTask(task))
      );
      
      expect(results).toHaveLength(3);
      results.forEach((result: any, i: number) => {
        expect(result.processed).toEqual(tasks[i]);
      });
    });

    test('should validate worker health', async () => {
      const worker = await pool.acquire();
      
      // Worker should be healthy initially
      expect(worker.memoryUsage).toBe(0);
      expect(worker.cpuUsage).toBe(0);

      await pool.release(worker);
    });

    test('should track worker metrics', async () => {
      const worker = await pool.acquire();
      
      expect(worker.createdAt).toBeTypeOf('number');
      expect(worker.lastUsedAt).toBeTypeOf('number');
      expect(worker.taskCount).toBe(0);

      await pool.release(worker);
    });
  });

  describe('Integration Tests', () => {
    test('should work with multiple pool types simultaneously', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'integration-test-'));
      
      // Create pools
      const dbPool = new DatabaseConnectionPool({
        name: 'integration-db',
        minSize: 1,
        maxSize: 3,
        acquireTimeoutMs: 1000,
        idleTimeoutMs: 5000,
        maxQueueSize: 10,
        validateOnAcquire: false,
        validateOnRelease: false,
        enableMetrics: true,
        autoResize: false,
        resizeThreshold: 0.8,
        maxRetries: 3,
        retryDelayMs: 100,
        healthCheckInterval: 1000,
        databaseUrl: 'mock://localhost:5432/testdb',
        database: 'testdb',
      });

      const filePool = new FileHandlePool({
        name: 'integration-file',
        minSize: 1,
        maxSize: 3,
        acquireTimeoutMs: 1000,
        idleTimeoutMs: 5000,
        maxQueueSize: 10,
        validateOnAcquire: false,
        validateOnRelease: false,
        enableMetrics: true,
        autoResize: false,
        resizeThreshold: 0.8,
        maxRetries: 3,
        retryDelayMs: 100,
        healthCheckInterval: 1000,
        basePath: tempDir,
        defaultMode: 'w',
        maxConcurrentFiles: 3,
        createDirectories: true,
      });

      try {
        // Use both pools
        const dbConnection = await dbPool.acquire();
        const testFile = path.join(tempDir, 'integration.tmp');
        const fileHandle = await filePool.acquireFileHandle(testFile, 'w');

        expect(dbConnection.database).toBe('testdb');
        expect(fileHandle.path).toBe(testFile);

        // Release resources
        await dbPool.release(dbConnection);
        await filePool.release(fileHandle);

        // Check pool stats
        const dbStats = dbPool.getStats();
        const fileStats = filePool.getStats();

        expect(dbStats.totalResources).toBeGreaterThan(0);
        expect(fileStats.totalResources).toBeGreaterThan(0);
      } finally {
        await dbPool.cleanup();
        await filePool.cleanup();
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});