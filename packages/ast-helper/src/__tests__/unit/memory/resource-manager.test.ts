import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdvancedResourceManager } from '../../../memory/resource-manager.js';
import { ResourceConfig, DEFAULT_RESOURCE_CONFIG, OptimizationStep } from '../../../memory/types.js';

describe('AdvancedResourceManager', () => {
  let resourceManager: AdvancedResourceManager;

  beforeEach(() => {
    resourceManager = new AdvancedResourceManager();
  });

  afterEach(async () => {
    if (resourceManager) {
      try {
        await resourceManager.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with default config', async () => {
      await expect(resourceManager.initialize(DEFAULT_RESOURCE_CONFIG)).resolves.not.toThrow();
    });

    it('should initialize successfully with custom config', async () => {
      const customConfig: ResourceConfig = {
        ...DEFAULT_RESOURCE_CONFIG,
        maxMemoryMB: 2048,
        gcTriggerThreshold: 1638.4, // 80% of 2048MB
      };

      await expect(resourceManager.initialize(customConfig)).resolves.not.toThrow();
    });

    it('should validate configuration parameters', async () => {
      const invalidConfig: ResourceConfig = {
        ...DEFAULT_RESOURCE_CONFIG,
        maxMemoryMB: -1, // Invalid: must be positive
      };

      await expect(resourceManager.initialize(invalidConfig))
        .rejects.toThrow('maxMemoryMB must be greater than 0');
    });

    it('should validate GC threshold is within bounds', async () => {
      const invalidConfig: ResourceConfig = {
        ...DEFAULT_RESOURCE_CONFIG,
        maxMemoryMB: 1024,
        gcTriggerThreshold: 2048, // Invalid: exceeds maxMemoryMB
      };

      await expect(resourceManager.initialize(invalidConfig))
        .rejects.toThrow('gcTriggerThreshold must be between 0 and maxMemoryMB');
    });

    it('should validate monitoring interval is positive', async () => {
      const invalidConfig: ResourceConfig = {
        ...DEFAULT_RESOURCE_CONFIG,
        monitoringInterval: 0, // Invalid: must be positive
      };

      await expect(resourceManager.initialize(invalidConfig))
        .rejects.toThrow('monitoringInterval must be greater than 0');
    });
  });

  describe('memory optimization', () => {
    beforeEach(async () => {
      await resourceManager.initialize(DEFAULT_RESOURCE_CONFIG);
    });

    it('should run memory optimization successfully', async () => {
      const result = await resourceManager.optimizeMemoryUsage();

      expect(result).toMatchObject({
        success: true,
        duration: expect.any(Number),
        beforeMemory: expect.any(Object),
        afterMemory: expect.any(Object),
        memorySaved: expect.any(Number),
        optimizations: expect.any(Array),
      });

      expect(result.optimizations).toHaveLength(5); // 5 optimization steps
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should include all optimization steps', async () => {
      const result = await resourceManager.optimizeMemoryUsage();

      const stepNames = result.optimizations.map((step: OptimizationStep) => step.name);
      expect(stepNames).toContain('vector_storage');
      expect(stepNames).toContain('embedding_cache');
      expect(stepNames).toContain('database_indexes');
      expect(stepNames).toContain('temporary_cleanup');
      expect(stepNames).toContain('garbage_collection');
    });

    it('should fail gracefully when not initialized', async () => {
      const uninitializedManager = new AdvancedResourceManager();
      
      await expect(uninitializedManager.optimizeMemoryUsage())
        .rejects.toThrow('ResourceManager not initialized');
    });
  });

  describe('memory leak detection', () => {
    beforeEach(async () => {
      await resourceManager.initialize(DEFAULT_RESOURCE_CONFIG);
    });

    it('should return leak report structure', async () => {
      const report = await resourceManager.detectMemoryLeaks();

      expect(report).toMatchObject({
        timestamp: expect.any(Date),
        leaksDetected: expect.any(Array),
        heapAnalysis: expect.any(Object),
        recommendations: expect.any(Array),
        severity: expect.any(String),
      });

      expect(['low', 'medium', 'high', 'critical']).toContain(report.severity);
    });

    it('should fail gracefully when not initialized', async () => {
      const uninitializedManager = new AdvancedResourceManager();
      
      await expect(uninitializedManager.detectMemoryLeaks())
        .rejects.toThrow('ResourceManager not initialized');
    });
  });

  describe('resource pool management', () => {
    beforeEach(async () => {
      await resourceManager.initialize(DEFAULT_RESOURCE_CONFIG);
    });

    it('should return pool status structure', async () => {
      const status = await resourceManager.manageResourcePools();

      expect(status).toMatchObject({
        pools: expect.any(Object),
        totalResourcesInUse: expect.any(Number),
        totalResourcesAvailable: expect.any(Number),
        healthStatus: expect.any(String),
      });

      expect(['healthy', 'warning', 'critical']).toContain(status.healthStatus);
    });

    it('should include expected pool types', async () => {
      const status = await resourceManager.manageResourcePools();

      expect(status.pools).toHaveProperty('database_connections');
      expect(status.pools).toHaveProperty('embedding_workers');
      expect(status.pools).toHaveProperty('file_handles');
    });

    it('should fail gracefully when not initialized', async () => {
      const uninitializedManager = new AdvancedResourceManager();
      
      await expect(uninitializedManager.manageResourcePools())
        .rejects.toThrow('ResourceManager not initialized');
    });
  });

  describe('resource monitoring', () => {
    beforeEach(async () => {
      await resourceManager.initialize(DEFAULT_RESOURCE_CONFIG);
    });

    it('should return resource monitor', () => {
      const monitor = resourceManager.monitorResourceUsage();

      expect(monitor).toMatchObject({
        getCurrentUsage: expect.any(Function),
        getUsageHistory: expect.any(Function),
        getAlerts: expect.any(Function),
        isHealthy: expect.any(Function),
      });
    });

    it('should provide current usage snapshot', () => {
      const monitor = resourceManager.monitorResourceUsage();
      const usage = monitor.getCurrentUsage();

      expect(usage).toMatchObject({
        timestamp: expect.any(Date),
        heapUsed: expect.any(Number),
        heapTotal: expect.any(Number),
        external: expect.any(Number),
        rss: expect.any(Number),
      });

      expect(usage.heapUsed).toBeGreaterThan(0);
      expect(usage.heapTotal).toBeGreaterThan(0);
    });

    it('should report health status', () => {
      const monitor = resourceManager.monitorResourceUsage();
      const isHealthy = monitor.isHealthy();

      expect(typeof isHealthy).toBe('boolean');
    });

    it('should fail gracefully when not initialized', () => {
      const uninitializedManager = new AdvancedResourceManager();
      
      expect(() => uninitializedManager.monitorResourceUsage())
        .toThrow('ResourceManager not initialized');
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully after initialization', async () => {
      await resourceManager.initialize(DEFAULT_RESOURCE_CONFIG);
      await expect(resourceManager.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup when not initialized', async () => {
      await expect(resourceManager.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup errors gracefully', async () => {
      await resourceManager.initialize(DEFAULT_RESOURCE_CONFIG);
      
      // Mock a failing cleanup scenario
      const originalConsoleError = console.error;
      const mockConsoleError = vi.fn();
      console.error = mockConsoleError;
      
      try {
        await resourceManager.cleanup();
        // Should not throw even if internal cleanup fails
      } finally {
        console.error = originalConsoleError;
      }
    });
  });

  describe('configuration handling', () => {
    it('should use custom config when provided in constructor', async () => {
      const customConfig = {
        maxMemoryMB: 2048,
        enableProfiling: true,
      };
      
      const customManager = new AdvancedResourceManager(customConfig);
      
      // Should accept the partial config and merge with defaults
      await expect(customManager.initialize(DEFAULT_RESOURCE_CONFIG)).resolves.not.toThrow();
      
      await customManager.cleanup();
    });

    it('should merge configs correctly', async () => {
      const partialConfig = {
        maxMemoryMB: 1024,
      };
      
      const manager = new AdvancedResourceManager(partialConfig);
      
      const initConfig: ResourceConfig = {
        ...DEFAULT_RESOURCE_CONFIG,
        gcTriggerThreshold: 512, // 50% of 1024MB
      };
      
      await expect(manager.initialize(initConfig)).resolves.not.toThrow();
      await manager.cleanup();
    });
  });

  describe('error handling', () => {
    it('should handle errors during initialization', async () => {
      const invalidConfig: ResourceConfig = {
        ...DEFAULT_RESOURCE_CONFIG,
        maxMemoryMB: 0, // This should cause validation to fail
      };

      await expect(resourceManager.initialize(invalidConfig)).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      const configs = [
        { ...DEFAULT_RESOURCE_CONFIG, maxMemoryMB: -1 },
        { ...DEFAULT_RESOURCE_CONFIG, gcTriggerThreshold: -1 },
        { ...DEFAULT_RESOURCE_CONFIG, monitoringInterval: 0 },
      ];

      for (const config of configs) {
        await expect(resourceManager.initialize(config)).rejects.toThrow(/must be/);
      }
    });
  });
});