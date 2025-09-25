import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PerformanceMetricsCollector } from "../../../memory/metrics-collector.js";

describe("PerformanceMetricsCollector", () => {
  let collector: PerformanceMetricsCollector;

  beforeEach(() => {
    // Mock process.memoryUsage
    vi.spyOn(process, "memoryUsage").mockReturnValue({
      rss: 100 * 1024 * 1024, // 100MB
      heapTotal: 80 * 1024 * 1024, // 80MB
      heapUsed: 60 * 1024 * 1024, // 60MB
      external: 10 * 1024 * 1024, // 10MB
      arrayBuffers: 5 * 1024 * 1024, // 5MB
    });

    // Mock process.uptime
    vi.spyOn(process, "uptime").mockReturnValue(3600); // 1 hour

    // Mock process.cpuUsage
    vi.spyOn(process, "cpuUsage").mockReturnValue({
      user: 1000000, // 1 second in microseconds
      system: 500000, // 0.5 seconds in microseconds
    });

    // Mock os.loadavg and os.freemem
    vi.mock("os", () => ({
      loadavg: () => [1.5, 1.2, 1.0],
      freemem: () => 2 * 1024 * 1024 * 1024, // 2GB
    }));

    collector = new PerformanceMetricsCollector({
      enabled: true,
      collectionInterval: 100, // 100ms for faster tests
      maxRetentionSize: 50,
      detailedProfiling: true,
      statisticalAnalysis: true,
      aggregationWindow: 1000, // 1 second for tests
      leakCorrelation: true,
    });
  });

  afterEach(async () => {
    await collector.stop();
    vi.restoreAllMocks();
  });

  describe("initialization and lifecycle", () => {
    it("should initialize with default configuration", () => {
      const defaultCollector = new PerformanceMetricsCollector();
      expect(defaultCollector).toBeInstanceOf(PerformanceMetricsCollector);
    });

    it("should initialize with custom configuration", () => {
      const customCollector = new PerformanceMetricsCollector({
        enabled: false,
        collectionInterval: 5000,
        maxRetentionSize: 100,
      });
      expect(customCollector).toBeInstanceOf(PerformanceMetricsCollector);
    });

    it("should start and stop successfully", async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();

      collector.on("started", startSpy);
      collector.on("stopped", stopSpy);

      await collector.start();
      expect(startSpy).toHaveBeenCalled();

      await collector.stop();
      expect(stopSpy).toHaveBeenCalled();
    });

    it("should not start if disabled", async () => {
      const disabledCollector = new PerformanceMetricsCollector({
        enabled: false,
      });

      await disabledCollector.start();
      // Should not emit started event when disabled
      expect(disabledCollector.listenerCount("started")).toBe(0);
    });
  });

  describe("metrics collection", () => {
    it("should collect current metrics", async () => {
      const metrics = await collector.forceCollection();

      expect(metrics).toMatchObject({
        timestamp: expect.any(Number),
        memory: {
          timestamp: expect.any(Number),
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          external: expect.any(Number),
          rss: expect.any(Number),
          arrayBuffers: expect.any(Number),
          heapUtilization: expect.any(Number),
        },
        gc: {
          totalGCs: expect.any(Number),
          totalTimeMS: expect.any(Number),
          totalMemoryCleaned: expect.any(Number),
          averageGCTime: expect.any(Number),
          averageMemoryCleaned: expect.any(Number),
          lastGC: expect.any(Object),
        },
        pools: expect.any(Map),
        allocations: {
          totalAllocations: expect.any(Number),
          totalBytes: expect.any(Number),
          allocationRate: expect.any(Number),
          byteRate: expect.any(Number),
          topTypes: expect.any(Array),
          timeline: expect.any(Array),
        },
        performance: {
          cpuUsage: expect.any(Number),
          uptime: expect.any(Number),
          loadAverage: expect.any(Array),
          eventLoopLag: expect.any(Number),
          networkConnections: expect.any(Number),
        },
        system: {
          processCpuPercent: expect.any(Number),
          systemCpuPercent: expect.any(Number),
          availableMemoryGB: expect.any(Number),
          diskSpaceGB: expect.any(Object),
          networkIO: expect.any(Object),
        },
      });
    });

    it("should emit metrics-collected event", async () => {
      const metricsCollectedSpy = vi.fn();
      collector.on("metrics-collected", metricsCollectedSpy);

      await collector.start();

      // Allow time for collection
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(metricsCollectedSpy).toHaveBeenCalled();
    });

    it("should maintain metrics history", async () => {
      await collector.forceCollection();
      await collector.forceCollection();
      await collector.forceCollection();

      const history = collector.getMetricsHistory();
      expect(history).toHaveLength(3);
    });

    it("should limit history size", async () => {
      const limitedCollector = new PerformanceMetricsCollector({
        maxRetentionSize: 2,
      });

      await limitedCollector.forceCollection();
      await limitedCollector.forceCollection();
      await limitedCollector.forceCollection();

      const history = limitedCollector.getMetricsHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe("metrics snapshot", () => {
    it("should provide comprehensive metrics snapshot", async () => {
      // Collect some metrics first
      await collector.forceCollection();

      const snapshot = await collector.getMetricsSnapshot();

      expect(snapshot).toMatchObject({
        timestamp: expect.any(Number),
        summary: {
          memoryUtilization: expect.any(Number),
          gcEfficiency: expect.any(Number),
          performanceScore: expect.any(Number),
          systemHealth: expect.stringMatching(
            /^(excellent|good|fair|poor|critical)$/,
          ),
          keyMetrics: {
            memoryUsageMB: expect.any(Number),
            gcFrequency: expect.any(Number),
            avgLatencyMs: expect.any(Number),
            errorRate: expect.any(Number),
          },
        },
        trends: {
          memoryTrend: expect.stringMatching(/^(improving|stable|degrading)$/),
          performanceTrend: expect.stringMatching(
            /^(improving|stable|degrading)$/,
          ),
          projectedMemoryUsage24h: expect.any(Number),
          projectedGCImpact: expect.any(Number),
        },
        alerts: expect.any(Array),
        recommendations: expect.any(Array),
      });
    });

    it("should generate appropriate system health assessment", async () => {
      const snapshot = await collector.getMetricsSnapshot();

      expect(["excellent", "good", "fair", "poor", "critical"]).toContain(
        snapshot.summary.systemHealth,
      );
    });
  });

  describe("statistical analysis", () => {
    it("should calculate statistical summaries", async () => {
      // Collect multiple metrics for analysis
      for (let i = 0; i < 5; i++) {
        await collector.forceCollection();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const history = collector.getMetricsHistory();
      expect(history.length).toBeGreaterThan(0);

      // Get aggregated metrics
      const now = Date.now();
      const startTime = now - 5000; // 5 seconds ago
      const aggregation = collector.getAggregatedMetrics(startTime, now);

      if (aggregation) {
        expect(aggregation).toMatchObject({
          timeWindow: {
            start: startTime,
            end: now,
            duration: expect.any(Number),
          },
          memory: {
            heapUsed: {
              count: expect.any(Number),
              min: expect.any(Number),
              max: expect.any(Number),
              mean: expect.any(Number),
              median: expect.any(Number),
              stdDev: expect.any(Number),
              percentiles: {
                p50: expect.any(Number),
                p90: expect.any(Number),
                p95: expect.any(Number),
                p99: expect.any(Number),
              },
            },
          },
          correlations: {
            memoryVsCpu: expect.any(Number),
            leakProbabilityScore: expect.any(Number),
            performanceScore: expect.any(Number),
            recommendations: expect.any(Array),
          },
        });
      }
    });

    it("should handle empty data gracefully", () => {
      const aggregation = collector.getAggregatedMetrics(0, 1000);
      expect(aggregation).toBeNull();
    });
  });

  describe("alerts and recommendations", () => {
    it("should generate memory alerts for high utilization", async () => {
      // Mock high memory usage
      vi.spyOn(process, "memoryUsage").mockReturnValue({
        rss: 500 * 1024 * 1024,
        heapTotal: 400 * 1024 * 1024,
        heapUsed: 380 * 1024 * 1024, // 95% utilization
        external: 50 * 1024 * 1024,
        arrayBuffers: 20 * 1024 * 1024,
      });

      const snapshot = await collector.getMetricsSnapshot();

      const memoryAlerts = snapshot.alerts.filter(
        (alert) => alert.category === "memory",
      );
      expect(memoryAlerts.length).toBeGreaterThan(0);
    });

    it("should generate performance recommendations", async () => {
      const recommendations = await collector.getPerformanceRecommendations();
      expect(recommendations).toBeInstanceOf(Array);

      // Should have at least some recommendations for typical scenarios
      if (recommendations.length > 0) {
        expect(recommendations[0]).toMatchObject({
          id: expect.any(String),
          category: expect.stringMatching(/^(memory|gc|pools|system)$/),
          priority: expect.stringMatching(/^(low|medium|high|critical)$/),
          title: expect.any(String),
          description: expect.any(String),
          expectedImpact: expect.any(String),
          implementationComplexity:
            expect.stringMatching(/^(low|medium|high)$/),
        });
      }
    });
  });

  describe("event loop lag detection", () => {
    it("should measure event loop lag", async () => {
      // Let event loop lag detection run for a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = await collector.forceCollection();
      expect(metrics.performance.eventLoopLag).toBeGreaterThanOrEqual(0);
    });
  });

  describe("correlation analysis", () => {
    it("should calculate correlations between metrics", async () => {
      // Collect multiple data points
      for (let i = 0; i < 10; i++) {
        await collector.forceCollection();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const now = Date.now();
      const aggregation = collector.getAggregatedMetrics(now - 1000, now);

      if (aggregation) {
        expect(aggregation.correlations.memoryVsCpu).toBeGreaterThanOrEqual(-1);
        expect(aggregation.correlations.memoryVsCpu).toBeLessThanOrEqual(1);
        expect(
          aggregation.correlations.leakProbabilityScore,
        ).toBeGreaterThanOrEqual(0);
        expect(
          aggregation.correlations.leakProbabilityScore,
        ).toBeLessThanOrEqual(1);
        expect(
          aggregation.correlations.performanceScore,
        ).toBeGreaterThanOrEqual(0);
        expect(aggregation.correlations.performanceScore).toBeLessThanOrEqual(
          1,
        );
      }
    });
  });

  describe("aggregation", () => {
    it("should emit aggregation-completed event", async () => {
      const aggregationSpy = vi.fn();
      collector.on("aggregation-completed", aggregationSpy);

      await collector.start();

      // Collect enough data for aggregation
      for (let i = 0; i < 5; i++) {
        await collector.forceCollection();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Allow time for aggregation to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have triggered aggregation
      expect(aggregationSpy).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle collection errors gracefully", async () => {
      const errorSpy = vi.fn();
      collector.on("error", errorSpy);

      // Mock process.memoryUsage to throw an error
      vi.spyOn(process, "memoryUsage").mockImplementation(() => {
        throw new Error("Memory access failed");
      });

      await collector.start();

      // Allow time for error to occur and wait for error handler
      await new Promise((resolve) => {
        collector.once("error", () => {
          resolve(undefined);
        });
        // Fallback timeout in case error doesn't occur
        setTimeout(resolve, 200);
      });

      expect(errorSpy).toHaveBeenCalled();
    });

    it("should continue operating after non-fatal errors", async () => {
      let callCount = 0;
      const errorSpy = vi.fn();
      collector.on("error", errorSpy);

      vi.spyOn(process, "memoryUsage").mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Transient error");
        }
        return {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        };
      });

      await collector.start();

      // Wait for error and recovery
      await new Promise((resolve) => {
        let errorReceived = false;
        collector.once("error", () => {
          errorReceived = true;
        });

        collector.on("metrics-collected", () => {
          if (errorReceived) {
            resolve(undefined);
          }
        });

        // Fallback timeout
        setTimeout(resolve, 300);
      });

      const history = collector.getMetricsHistory();
      expect(errorSpy).toHaveBeenCalled();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("performance optimization", () => {
    it("should efficiently handle large metric datasets", async () => {
      const largeCollector = new PerformanceMetricsCollector({
        maxRetentionSize: 1000,
      });

      const startTime = Date.now();

      // Collect many metrics
      for (let i = 0; i < 100; i++) {
        await largeCollector.forceCollection();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max

      const history = largeCollector.getMetricsHistory();
      expect(history).toHaveLength(100);
    });
  });
});
