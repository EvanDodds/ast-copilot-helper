/**
 * Tests for Model Usage Analytics functionality in MetadataManager
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { MetadataManager } from "../metadata.js";
import { ModelConfig, ModelMetadata } from "../types.js";

describe("MetadataManager - Usage Analytics", () => {
  let manager: MetadataManager;
  let testDir: string;

  const mockModelConfig: ModelConfig = {
    name: "test-analytics-model",
    version: "1.0.0",
    url: "https://example.com/model.onnx",
    checksum: "abc123def456",
    size: 1024 * 1024,
    format: "onnx",
    dimensions: 384,
    description: "Test model for analytics",
  };

  beforeEach(async () => {
    testDir = join(process.cwd(), `test-analytics-${Date.now()}`);
    manager = new MetadataManager(testDir);
    await manager.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to cleanup test directory:", error);
    }
  });

  describe("recordModelUsage", () => {
    it("should record basic usage statistics", async () => {
      const usageData = {
        processingTime: 150,
        memoryUsage: 512 * 1024 * 1024, // 512MB
        itemsProcessed: 10,
        success: true,
        cacheHitRate: 75,
      };

      await manager.recordModelUsage(mockModelConfig, usageData);

      const metadata = await manager.getMetadata(mockModelConfig);
      expect(metadata).toBeTruthy();
      expect(metadata!.usageStats).toBeTruthy();

      const stats = metadata!.usageStats!;
      expect(stats.loadCount).toBe(1);
      expect(stats.totalProcessingTime).toBe(150);
      expect(stats.embeddingRequests).toBe(10);
      expect(stats.averageProcessingTime).toBe(150);
      expect(stats.peakMemoryUsage).toBe(512 * 1024 * 1024);
      expect(stats.successRate).toBe(100);
      expect(stats.errorCount).toBe(0);
      expect(stats.cacheHitRate).toBe(75);
    });

    it("should accumulate usage statistics over multiple uses", async () => {
      // First usage
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 100,
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 5,
        success: true,
      });

      // Second usage
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 200,
        memoryUsage: 512 * 1024 * 1024,
        itemsProcessed: 8,
        success: true,
      });

      const metadata = await manager.getMetadata(mockModelConfig);
      const stats = metadata!.usageStats!;

      expect(stats.loadCount).toBe(2);
      expect(stats.totalProcessingTime).toBe(300);
      expect(stats.embeddingRequests).toBe(13);
      expect(stats.averageProcessingTime).toBe(150); // 300/2
      expect(stats.peakMemoryUsage).toBe(512 * 1024 * 1024);
      expect(stats.successRate).toBe(100);
    });

    it("should track error rates correctly", async () => {
      // Successful usage
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 100,
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 5,
        success: true,
      });

      // Failed usage
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 50,
        memoryUsage: 128 * 1024 * 1024,
        itemsProcessed: 0,
        success: false,
        errorMessage: "Processing failed",
      });

      const metadata = await manager.getMetadata(mockModelConfig);
      const stats = metadata!.usageStats!;

      expect(stats.loadCount).toBe(2);
      expect(stats.errorCount).toBe(1);
      expect(stats.successRate).toBe(50); // 1 success out of 2 attempts
    });

    it("should track usage patterns by time", async () => {
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay();

      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 100,
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 5,
        success: true,
      });

      const metadata = await manager.getMetadata(mockModelConfig);
      const stats = metadata!.usageStats!;

      expect(stats.hourlyUsage[hour]).toBe(1);
      expect(stats.weeklyUsage[dayOfWeek]).toBe(1);
    });

    it("should maintain performance history", async () => {
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 100,
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 5,
        success: true,
        cacheHitRate: 80,
      });

      const metadata = await manager.getMetadata(mockModelConfig);
      const stats = metadata!.usageStats!;

      expect(stats.performanceHistory).toHaveLength(1);
      const entry = stats.performanceHistory[0];
      expect(entry.processingTime).toBe(100);
      expect(entry.memoryUsage).toBe(256 * 1024 * 1024);
      expect(entry.itemsProcessed).toBe(5);
      expect(entry.success).toBe(true);
      expect(entry.cacheHitRate).toBe(80);
    });

    it("should limit performance history to 100 entries", async () => {
      // Add 105 entries
      for (let i = 0; i < 105; i++) {
        await manager.recordModelUsage(mockModelConfig, {
          processingTime: 100 + i,
          memoryUsage: 256 * 1024 * 1024,
          itemsProcessed: 1,
          success: true,
        });
      }

      const metadata = await manager.getMetadata(mockModelConfig);
      const stats = metadata!.usageStats!;

      // Should be limited to 100 entries (last 100)
      expect(stats.performanceHistory).toHaveLength(100);
      expect(stats.performanceHistory[0].processingTime).toBe(105); // First should be entry #5
      expect(stats.performanceHistory[99].processingTime).toBe(204); // Last should be entry #104
    });
  });

  describe("getUsageAnalytics", () => {
    beforeEach(async () => {
      // Set up some test data
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 150,
        memoryUsage: 512 * 1024 * 1024,
        itemsProcessed: 10,
        success: true,
        cacheHitRate: 85,
      });

      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 200,
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 8,
        success: true,
        cacheHitRate: 90,
      });
    });

    it("should return comprehensive usage analytics", async () => {
      const analytics = await manager.getUsageAnalytics(mockModelConfig);

      expect(analytics).toBeTruthy();
      expect(analytics!.modelName).toBe("test-analytics-model");
      expect(analytics!.modelVersion).toBe("1.0.0");
      expect(analytics!.totalUsage).toBe(2);
      expect(analytics!.totalProcessingTime).toBe(350);
      expect(analytics!.averageProcessingTime).toBe(175);
      expect(analytics!.peakMemoryUsage).toBe(512 * 1024 * 1024);
      expect(analytics!.successRate).toBe(100);
      expect(analytics!.errorCount).toBe(0);
      expect(analytics!.cacheEfficiency).toBe(87.5); // Average of 85 and 90
    });

    it("should return null for non-existent models", async () => {
      const nonExistentModel: ModelConfig = {
        ...mockModelConfig,
        name: "non-existent-model",
      };

      const analytics = await manager.getUsageAnalytics(nonExistentModel);
      expect(analytics).toBeNull();
    });

    it("should include recent performance data", async () => {
      const analytics = await manager.getUsageAnalytics(mockModelConfig);

      expect(analytics!.recentPerformance).toHaveLength(2);
      expect(analytics!.recentPerformance[0].processingTime).toBe(150);
      expect(analytics!.recentPerformance[1].processingTime).toBe(200);
    });

    it("should generate optimization recommendations", async () => {
      // Add some poor performance data
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 2000, // Very slow
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 1,
        success: false, // Failed
        errorMessage: "Timeout error",
      });

      const analytics = await manager.getUsageAnalytics(mockModelConfig);

      expect(analytics!.recommendedOptimizations.length).toBeGreaterThan(0);
      expect(
        analytics!.recommendedOptimizations.some(
          (rec) =>
            rec.includes("processing time") || rec.includes("Success rate"),
        ),
      ).toBe(true);
    });
  });

  describe("getSystemUsageAnalytics", () => {
    beforeEach(async () => {
      // Create multiple test models with usage data
      const model1: ModelConfig = { ...mockModelConfig, name: "model-1" };
      const model2: ModelConfig = { ...mockModelConfig, name: "model-2" };

      await manager.recordModelUsage(model1, {
        processingTime: 100,
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 10,
        success: true,
      });

      await manager.recordModelUsage(model2, {
        processingTime: 200,
        memoryUsage: 512 * 1024 * 1024,
        itemsProcessed: 5,
        success: true,
      });
    });

    it("should return system-wide analytics", async () => {
      const systemAnalytics = await manager.getSystemUsageAnalytics();

      expect(systemAnalytics.totalModels).toBe(2);
      expect(systemAnalytics.totalUsage).toBe(2);
      expect(systemAnalytics.totalProcessingTime).toBe(300);
      expect(systemAnalytics.averageSuccessRate).toBe(100);
      expect(systemAnalytics.topPerformingModels).toHaveLength(2);
    });

    it("should rank models by performance score", async () => {
      const systemAnalytics = await manager.getSystemUsageAnalytics();
      const topModels = systemAnalytics.topPerformingModels;

      expect(topModels[0].score).toBeGreaterThanOrEqual(topModels[1].score);
    });

    it("should generate system-level recommendations", async () => {
      // Add some poor system performance
      const model3: ModelConfig = { ...mockModelConfig, name: "slow-model" };

      // Add very slow performance
      await manager.recordModelUsage(model3, {
        processingTime: 5000, // 5 seconds
        memoryUsage: 1024 * 1024 * 1024,
        itemsProcessed: 1,
        success: false,
      });

      const systemAnalytics = await manager.getSystemUsageAnalytics();

      expect(systemAnalytics.recommendedActions.length).toBeGreaterThan(0);
    });
  });

  describe("createInitialUsageStats", () => {
    it("should create properly initialized usage stats", async () => {
      // Force creation of metadata with initial stats
      await manager.recordModelUsage(mockModelConfig, {
        processingTime: 100,
        memoryUsage: 256 * 1024 * 1024,
        itemsProcessed: 1,
        success: true,
      });

      const metadata = await manager.getMetadata(mockModelConfig);
      const stats = metadata!.usageStats!;

      expect(stats.loadCount).toBe(1);
      expect(stats.firstUsed).toBeTruthy();
      expect(stats.lastUsed).toBeTruthy();
      expect(stats.totalProcessingTime).toBe(100);
      expect(stats.embeddingRequests).toBe(1);
      expect(stats.averageProcessingTime).toBe(100);
      expect(stats.peakMemoryUsage).toBe(256 * 1024 * 1024);
      expect(stats.errorCount).toBe(0);
      expect(stats.successRate).toBe(100);
      expect(stats.performanceHistory).toHaveLength(1);
      expect(stats.hourlyUsage).toBeTruthy();
      expect(stats.weeklyUsage).toBeTruthy();
    });
  });
});
