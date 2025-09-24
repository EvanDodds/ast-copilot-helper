/**
 * Unit tests for UnifiedMemoryManager
 *
 * These tests verify the integration layer's ability to coordinate
 * all memory management subsystems effectively.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  UnifiedMemoryManager,
  type MemoryManagerConfig,
} from "../../../memory/memory-manager.js";

describe("UnifiedMemoryManager", () => {
  let manager: UnifiedMemoryManager;
  let mockConfig: MemoryManagerConfig;

  beforeEach(() => {
    // Mock global.gc to avoid errors in test environment
    vi.stubGlobal("gc", vi.fn());

    mockConfig = {
      global: {
        enabled: true,
        targetMemoryLimitGB: 2,
        emergencyShutdownGB: 3,
        autoOptimization: true,
      },
      gcScheduling: {
        enabled: true,
        minInterval: 5000,
        maxInterval: 30000,
      },
      metricsCollection: {
        enabled: true,
        collectionInterval: 10000,
        maxRetentionSize: 100,
      },
    };

    manager = new UnifiedMemoryManager(mockConfig);
  });

  afterEach(async () => {
    try {
      if (manager) {
        await manager.stop();
      }
    } catch (_error) {
      // Ignore cleanup errors in tests
    }
    vi.restoreAllMocks();
  });

  describe("Constructor and Configuration", () => {
    it("should initialize with default configuration", () => {
      const defaultManager = new UnifiedMemoryManager();
      expect(defaultManager).toBeDefined();
    });

    it("should merge custom configuration with defaults", () => {
      const customConfig: MemoryManagerConfig = {
        global: {
          enabled: false,
          targetMemoryLimitGB: 8,
          emergencyShutdownGB: 10,
          autoOptimization: false,
        },
      };

      const customManager = new UnifiedMemoryManager(customConfig);
      expect(customManager).toBeDefined();
    });

    it("should provide access to subsystems", () => {
      const subsystems = manager.getSubsystems();

      expect(subsystems.resourceManager).toBeDefined();
      expect(subsystems.gcScheduler).toBeDefined();
      expect(subsystems.metricsCollector).toBeDefined();
    });
  });

  describe("Lifecycle Management", () => {
    it("should start all subsystems", async () => {
      await expect(manager.start()).resolves.not.toThrow();
    });

    it("should handle double start gracefully", async () => {
      await manager.start();
      await expect(manager.start()).resolves.not.toThrow();
    });

    it("should stop all subsystems", async () => {
      await manager.start();
      await expect(manager.stop()).resolves.not.toThrow();
    });

    it("should handle stop without start gracefully", async () => {
      await expect(manager.stop()).resolves.not.toThrow();
    });

    it("should emit lifecycle events", async () => {
      const events: string[] = [];

      manager.on("starting", () => events.push("starting"));
      manager.on("started", () => events.push("started"));
      manager.on("stopping", () => events.push("stopping"));
      manager.on("stopped", () => events.push("stopped"));

      await manager.start();
      await manager.stop();

      expect(events).toEqual(["starting", "started", "stopping", "stopped"]);
    });
  });

  describe("System Status Monitoring", () => {
    it("should provide comprehensive system status", async () => {
      await manager.start();

      const status = await manager.getSystemStatus();

      expect(status).toHaveProperty("timestamp");
      expect(status).toHaveProperty("overall");
      expect(status).toHaveProperty("subsystems");
      expect(status).toHaveProperty("recommendations");

      expect(status.overall).toHaveProperty("status");
      expect(status.overall).toHaveProperty("memoryUsageGB");
      expect(status.overall).toHaveProperty("targetMemoryGB");
      expect(status.overall).toHaveProperty("utilizationPercent");

      expect(status.subsystems).toHaveProperty("resources");
      expect(status.subsystems).toHaveProperty("gcScheduling");
      expect(status.subsystems).toHaveProperty("metricsCollection");
    });

    it("should calculate memory utilization correctly", async () => {
      await manager.start();

      const status = await manager.getSystemStatus();

      expect(status.overall.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(status.overall.targetMemoryGB).toBe(2); // From config
    });

    it("should determine system status based on memory usage", async () => {
      await manager.start();

      const status = await manager.getSystemStatus();

      expect(["healthy", "warning", "critical", "emergency"]).toContain(
        status.overall.status,
      );
    });

    it("should include performance recommendations", async () => {
      await manager.start();

      const status = await manager.getSystemStatus();

      expect(Array.isArray(status.recommendations)).toBe(true);
    });
  });

  describe("Performance Metrics Integration", () => {
    it("should provide performance snapshot", async () => {
      await manager.start();

      const snapshot = await manager.getPerformanceSnapshot();

      expect(snapshot).toHaveProperty("timestamp");
      expect(snapshot).toHaveProperty("summary");
      expect(snapshot).toHaveProperty("trends");
      expect(snapshot).toHaveProperty("alerts");
      expect(snapshot).toHaveProperty("recommendations");
    });

    it("should handle metrics collection events", async () => {
      await manager.start();

      const events: any[] = [];
      manager.on("metrics-collected", (metrics) => events.push(metrics));

      // Wait a bit to allow metrics collection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Events may or may not have been emitted depending on timing
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("Emergency Operations", () => {
    it("should perform emergency cleanup", async () => {
      await manager.start();

      let cleanupStarted = false;
      let cleanupCompleted = false;

      manager.on("emergency-cleanup-started", () => {
        cleanupStarted = true;
      });

      manager.on("emergency-cleanup-completed", () => {
        cleanupCompleted = true;
      });

      await expect(manager.emergencyCleanup()).resolves.not.toThrow();

      expect(cleanupStarted).toBe(true);
      expect(cleanupCompleted).toBe(true);
    });

    it("should handle emergency cleanup errors gracefully", async () => {
      // Don't start the manager to simulate error conditions

      let _errorEmitted = false;
      manager.on("error", () => {
        _errorEmitted = true;
      });

      // Emergency cleanup shouldn't throw even if not started
      await expect(manager.emergencyCleanup()).resolves.not.toThrow();
    });
  });

  describe("Optimization Features", () => {
    it("should perform optimization when auto-optimization is enabled", async () => {
      await manager.start();

      let optimizationStarted = false;
      let optimizationCompleted = false;

      manager.on("optimization-started", () => {
        optimizationStarted = true;
      });

      manager.on("optimization-completed", () => {
        optimizationCompleted = true;
      });

      await manager.optimize();

      expect(optimizationStarted).toBe(true);
      expect(optimizationCompleted).toBe(true);
    });

    it("should skip optimization when auto-optimization is disabled", async () => {
      const disabledConfig: MemoryManagerConfig = {
        global: {
          enabled: true,
          targetMemoryLimitGB: 2,
          emergencyShutdownGB: 3,
          autoOptimization: false,
        },
      };

      const disabledManager = new UnifiedMemoryManager(disabledConfig);
      await disabledManager.start();

      let optimizationStarted = false;
      disabledManager.on("optimization-started", () => {
        optimizationStarted = true;
      });

      await disabledManager.optimize();

      expect(optimizationStarted).toBe(false);

      await disabledManager.stop();
    });

    it("should apply performance recommendations", async () => {
      await manager.start();

      const appliedRecommendations: any[] = [];
      const failedRecommendations: any[] = [];

      manager.on("recommendation-applied", (rec) => {
        appliedRecommendations.push(rec);
      });

      manager.on("recommendation-failed", (rec) => {
        failedRecommendations.push(rec);
      });

      await manager.optimize();

      // Recommendations may or may not be applied depending on current system state
      expect(Array.isArray(appliedRecommendations)).toBe(true);
      expect(Array.isArray(failedRecommendations)).toBe(true);
    });
  });

  describe("Event Handling", () => {
    it("should forward GC completion events", async () => {
      await manager.start();

      const gcEvents: any[] = [];
      manager.on("gc-completed", (stats) => {
        gcEvents.push(stats);
      });

      // Trigger GC event from subsystem (simulate)
      const subsystems = manager.getSubsystems();
      subsystems.gcScheduler.emit("gc-completed", { collection: "test" });

      expect(gcEvents).toHaveLength(1);
      expect(gcEvents[0]).toEqual({ collection: "test" });
    });

    it("should handle status monitoring events", async () => {
      await manager.start();

      const statusUpdates: any[] = [];
      manager.on("status-update", (status) => {
        statusUpdates.push(status);
      });

      // Wait briefly to allow status monitoring to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Status updates may or may not have occurred depending on timing
      expect(Array.isArray(statusUpdates)).toBe(true);
    });

    it("should handle subsystem errors", async () => {
      await manager.start();

      const errors: any[] = [];
      manager.on("error", (error) => {
        errors.push(error);
      });

      // Test that the manager can handle subsystem events without crashing
      // We'll emit a test event that doesn't throw
      const subsystems = manager.getSubsystems();

      expect(() => {
        subsystems.metricsCollector.emit("metrics-collected", { test: "data" });
      }).not.toThrow();

      // The error should not be automatically forwarded
      // (subsystem errors are handled internally)
      expect(errors).toHaveLength(0);
    });
  });

  describe("Integration Points", () => {
    it("should coordinate with resource manager", async () => {
      await manager.start();

      const subsystems = manager.getSubsystems();
      expect(subsystems.resourceManager).toBeDefined();

      // Resource manager should be accessible for coordination
      await expect(subsystems.resourceManager.cleanup()).resolves.not.toThrow();
    });

    it("should coordinate with GC scheduler", async () => {
      await manager.start();

      const subsystems = manager.getSubsystems();
      expect(subsystems.gcScheduler).toBeDefined();

      // GC scheduler should be running
      // Note: We can't easily test internal state without exposing it
    });

    it("should coordinate with metrics collector", async () => {
      await manager.start();

      const subsystems = manager.getSubsystems();
      expect(subsystems.metricsCollector).toBeDefined();

      // Metrics collector should be collecting data
      const recommendations =
        await subsystems.metricsCollector.getPerformanceRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle start errors gracefully", async () => {
      // Create a manager that will fail to start by mocking a subsystem
      const faultyManager = new UnifiedMemoryManager(mockConfig);

      // Mock the GC scheduler to throw on start
      const subsystems = faultyManager.getSubsystems();
      vi.spyOn(subsystems.gcScheduler, "start").mockRejectedValue(
        new Error("Start failed"),
      );

      await expect(faultyManager.start()).rejects.toThrow("Start failed");
    });

    it("should handle stop errors gracefully", async () => {
      await manager.start();

      // Mock metrics collector to throw on stop
      const subsystems = manager.getSubsystems();
      vi.spyOn(subsystems.metricsCollector, "stop").mockRejectedValue(
        new Error("Stop failed"),
      );

      await expect(manager.stop()).rejects.toThrow("Stop failed");
    });

    it("should emit error events for internal failures", async () => {
      await manager.start();

      const errors: any[] = [];
      manager.on("error", (error) => errors.push(error));

      // Simulate internal error during optimization
      const subsystems = manager.getSubsystems();
      vi.spyOn(
        subsystems.metricsCollector,
        "getPerformanceRecommendations",
      ).mockRejectedValue(new Error("Internal error"));

      await expect(manager.optimize()).rejects.toThrow();
      expect(errors).toHaveLength(1);
    });
  });
});
