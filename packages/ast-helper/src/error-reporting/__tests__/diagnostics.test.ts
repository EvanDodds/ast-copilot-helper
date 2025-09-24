/**
 * @fileoverview Tests for diagnostic data collection system
 * @module tests/unit/error-reporting/diagnostics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DiagnosticManager,
  SystemDiagnosticCollector,
  RuntimeDiagnosticCollector,
  CodebaseDiagnosticCollector,
} from "../../../src/error-reporting/diagnostics/index.js";

describe("Diagnostic Collection System", () => {
  describe("SystemDiagnosticCollector", () => {
    let collector: SystemDiagnosticCollector;

    beforeEach(() => {
      collector = new SystemDiagnosticCollector();
    });

    it("should have correct metadata", () => {
      expect(collector.name).toBe("system");
      expect(collector.scope).toBe("system");
      expect(collector.priority).toBe(100); // High priority for system info
      expect(collector.cacheTTL).toBe(30000); // 30 seconds
    });

    it("should be able to collect system diagnostics", async () => {
      const canCollect = await collector.canCollect();
      expect(canCollect).toBe(true);
    });

    it("should estimate collection time", () => {
      const estimatedTime = collector.estimateCollectionTime();
      expect(estimatedTime).toBeGreaterThan(0);
      expect(typeof estimatedTime).toBe("number");
    });

    it("should collect system diagnostic data", async () => {
      const data = await collector.collect();

      expect(data).toBeDefined();
      expect(data.system).toBeDefined();

      if (data.system) {
        expect(data.system.os).toBeDefined();
        expect(data.system.cpu).toBeDefined();
        expect(data.system.memory).toBeDefined();
        expect(data.system.disk).toBeDefined();
        expect(data.system.network).toBeDefined();

        // Verify OS info structure
        expect(data.system.os.platform).toBeDefined();
        expect(data.system.os.version).toBeDefined();
        expect(data.system.os.arch).toBeDefined();

        // Verify CPU info structure
        expect(data.system.cpu.cores).toBeGreaterThan(0);
        expect(data.system.cpu.model).toBeDefined();
        expect(data.system.cpu.speed).toBeGreaterThanOrEqual(0); // Speed might be 0 in some envs

        // Verify memory info structure
        expect(data.system.memory.total).toBeGreaterThan(0);
        expect(data.system.memory.free).toBeGreaterThanOrEqual(0);
        expect(data.system.memory.used).toBeGreaterThanOrEqual(0);

        // Verify network info structure
        expect(data.system.network.interfaces).toBeInstanceOf(Array);
        expect(data.system.network.activeConnections).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("RuntimeDiagnosticCollector", () => {
    let collector: RuntimeDiagnosticCollector;

    beforeEach(() => {
      collector = new RuntimeDiagnosticCollector();
    });

    it("should have correct metadata", () => {
      expect(collector.name).toBe("runtime");
      expect(collector.scope).toBe("runtime");
      expect(collector.priority).toBe(2);
      expect(collector.cacheTTL).toBe(30000);
    });

    it("should be able to collect runtime diagnostics", async () => {
      const canCollect = await collector.canCollect();
      expect(canCollect).toBe(true);
    });

    it("should collect runtime diagnostic data", async () => {
      const data = await collector.collect();

      expect(data).toBeDefined();
      expect(data.runtime).toBeDefined();

      if (data.runtime) {
        expect(data.runtime.node).toBeDefined();
        expect(data.runtime.heap).toBeDefined();
        expect(data.runtime.gc).toBeDefined();
        expect(data.runtime.eventLoop).toBeDefined();
        expect(data.runtime.modules).toBeDefined();

        // Verify Node.js info
        expect(data.runtime.node.version).toBeDefined();
        expect(data.runtime.node.platform).toBeDefined();
        expect(data.runtime.node.arch).toBeDefined();
        expect(data.runtime.node.pid).toBeGreaterThan(0);
        expect(data.runtime.node.uptime).toBeGreaterThanOrEqual(0);

        // Verify heap info
        expect(data.runtime.heap.used).toBeGreaterThan(0);
        expect(data.runtime.heap.total).toBeGreaterThan(0);
        expect(data.runtime.heap.limit).toBeGreaterThan(0);
        expect(data.runtime.heap.percentage).toBeGreaterThanOrEqual(0);

        // Verify modules info
        expect(data.runtime.modules.loaded).toBeInstanceOf(Array);
        expect(data.runtime.modules.cache).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("CodebaseDiagnosticCollector", () => {
    let collector: CodebaseDiagnosticCollector;

    beforeEach(() => {
      collector = new CodebaseDiagnosticCollector();
    });

    it("should have correct metadata", () => {
      expect(collector.name).toBe("codebase");
      expect(collector.scope).toBe("codebase");
      expect(collector.priority).toBe(3);
      expect(collector.cacheTTL).toBe(60000);
    });

    it("should be able to collect codebase diagnostics", async () => {
      const canCollect = await collector.canCollect();
      expect(canCollect).toBe(true);
    });

    it("should collect codebase diagnostic data", async () => {
      const data = await collector.collect();

      expect(data).toBeDefined();
      expect(data.codebase).toBeDefined();

      if (data.codebase) {
        expect(data.codebase.structure).toBeDefined();
        expect(data.codebase.git).toBeDefined();
        expect(data.codebase.packages).toBeDefined();
        expect(data.codebase.complexity).toBeDefined();

        // Verify structure info
        expect(data.codebase.structure.totalFiles).toBeGreaterThanOrEqual(0);
        expect(data.codebase.structure.totalDirectories).toBeGreaterThanOrEqual(
          0,
        );
        expect(data.codebase.structure.totalSize).toBeGreaterThanOrEqual(0);
        expect(data.codebase.structure.languages).toBeDefined();
        expect(data.codebase.structure.fileTypes).toBeDefined();
        expect(data.codebase.structure.largestFiles).toBeInstanceOf(Array);

        // Verify git info
        expect(typeof data.codebase.git.isRepository).toBe("boolean");

        // Verify packages info
        expect(typeof data.codebase.packages.packageJson).toBe("boolean");
        expect(typeof data.codebase.packages.lockFile).toBe("boolean");

        // Verify complexity info
        expect(
          data.codebase.complexity.averageLinesPerFile,
        ).toBeGreaterThanOrEqual(0);
        expect(
          data.codebase.complexity.totalLinesOfCode,
        ).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("DiagnosticManager", () => {
    let manager: DiagnosticManager;

    beforeEach(() => {
      manager = new DiagnosticManager();
    });

    afterEach(() => {
      manager.clearCache();
    });

    it("should initialize with default collectors", () => {
      const collectors = manager.getCollectors();
      expect(collectors.length).toBe(3);

      const collectorNames = collectors.map((c) => c.name);
      expect(collectorNames).toContain("system");
      expect(collectorNames).toContain("runtime");
      expect(collectorNames).toContain("codebase");
    });

    it("should provide estimated collection time", () => {
      const estimatedTime = manager.getEstimatedCollectionTime();
      expect(estimatedTime).toBeGreaterThan(0);
      expect(typeof estimatedTime).toBe("number");
    });

    it("should collect diagnostics from all collectors", async () => {
      const result = await manager.collectDiagnostics();

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.metrics).toBeDefined();

      // Verify metrics structure
      expect(result.metrics.startTime).toBeGreaterThan(0);
      expect(result.metrics.endTime).toBeGreaterThan(0);
      expect(result.metrics.duration).toBeGreaterThan(0);
      expect(result.metrics.collectorsRun).toBeGreaterThanOrEqual(0);
      expect(result.metrics.collectorsSkipped).toBeGreaterThanOrEqual(0);
      expect(result.metrics.errors).toBeGreaterThanOrEqual(0);

      // Verify diagnostic data structure
      const { data } = result;
      expect(data.system || data.runtime || data.codebase).toBeDefined();
    });

    it("should handle collector registration and unregistration", () => {
      const initialCount = manager.getCollectors().length;

      // Create a mock collector
      const mockCollector = {
        name: "mock",
        scope: "system" as const,
        priority: 0,
        canCollect: async () => true,
        collect: async () => ({}),
        estimateCollectionTime: () => 100,
      };

      // Register collector
      manager.registerCollector(mockCollector);
      expect(manager.getCollectors().length).toBe(initialCount + 1);

      // Unregister collector
      manager.unregisterCollector("mock");
      expect(manager.getCollectors().length).toBe(initialCount);
    });

    it("should manage cache correctly", async () => {
      // Clear cache to start fresh
      manager.clearCache();

      // First collection should hit all collectors
      const result1 = await manager.collectDiagnostics();
      expect(result1.metrics.cacheMisses).toBeGreaterThan(0);
      expect(result1.metrics.cacheHits).toBe(0);

      // Second collection should use some cached results
      const result2 = await manager.collectDiagnostics();
      expect(result2.metrics.cacheHits).toBeGreaterThan(0);

      // Verify cache stats
      const cacheStats = manager.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
      expect(cacheStats.entries.length).toBeGreaterThan(0);
    });

    it("should collect specific diagnostic scopes", async () => {
      const result = await manager.collectSpecificDiagnostics(["runtime"]);

      expect(result.data).toBeDefined();
      expect(result.metrics.collectorsRun).toBeLessThanOrEqual(1);

      // Should only contain runtime data if collection was successful
      if (result.data.runtime) {
        expect(result.data.system).toBeUndefined();
        expect(result.data.codebase).toBeUndefined();
      }
    });

    it("should handle configuration updates", () => {
      const originalConfig = manager.getConfig();

      manager.updateConfig({
        timeout: 5000,
        privacyLevel: "minimal",
      });

      const updatedConfig = manager.getConfig();
      expect(updatedConfig.timeout).toBe(5000);
      expect(updatedConfig.privacyLevel).toBe("minimal");
      expect(updatedConfig.enabled).toBe(originalConfig.enabled); // Should preserve other settings
    });

    it("should not collect when disabled", async () => {
      manager.updateConfig({ enabled: false });

      const result = await manager.collectDiagnostics();

      expect(result.data).toEqual({});
      expect(result.metrics.collectorsRun).toBe(0);
    });
  });
});
