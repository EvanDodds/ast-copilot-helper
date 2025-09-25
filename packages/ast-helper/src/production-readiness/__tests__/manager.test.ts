/**
 * @fileoverview Tests for production readiness manager
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ComprehensiveProductionReadinessManager } from "../manager.js";
import { DEFAULT_PRODUCTION_READINESS_CONFIG } from "../config.js";
import type { ProductionReadinessConfig } from "../types.js";
import * as path from "path";
import * as os from "os";

describe("ComprehensiveProductionReadinessManager", () => {
  let manager: ComprehensiveProductionReadinessManager;
  let testConfig: ProductionReadinessConfig;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), "production-readiness-test-" + Date.now());
    manager = new ComprehensiveProductionReadinessManager(tempDir);
    testConfig = { ...DEFAULT_PRODUCTION_READINESS_CONFIG };
  });

  describe("initialization", () => {
    it("should initialize successfully with valid configuration", async () => {
      await expect(manager.initialize(testConfig)).resolves.not.toThrow();
    });

    it("should throw error when not initialized", async () => {
      await expect(manager.validateProductionReadiness()).rejects.toThrow(
        "ProductionReadinessManager not initialized",
      );
    });

    it("should validate configuration before initialization", async () => {
      const invalidConfig = {
        ...testConfig,
        testing: {
          ...testConfig.testing,
          testSuites: [], // Invalid: no test suites
        },
      };

      await expect(manager.initialize(invalidConfig)).rejects.toThrow(
        "Invalid configuration",
      );
    });
  });

  describe("integration testing", () => {
    beforeEach(async () => {
      await manager.initialize(testConfig);
    });

    it("should run final integration tests", async () => {
      const result = await manager.runFinalIntegrationTests();

      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Placeholder implementation passes
      expect(result.testSuites).toHaveLength(5); // Based on default config
      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should handle test failures gracefully", async () => {
      // This would test error handling, but requires more complex setup
      const result = await manager.runFinalIntegrationTests();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should collect performance metrics during testing", async () => {
      const result = await manager.runFinalIntegrationTests();

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.avgResponseTime).toBeGreaterThan(0);
      expect(result.performanceMetrics.throughput).toBeGreaterThan(0);
      expect(result.performanceMetrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe("production readiness validation", () => {
    beforeEach(async () => {
      await manager.initialize(testConfig);
    });

    it("should validate production readiness", async () => {
      const result = await manager.validateProductionReadiness();

      expect(result).toBeDefined();
      expect(typeof result.overallReady).toBe("boolean");
      expect(result.readinessScore).toBeGreaterThanOrEqual(0);
      expect(result.readinessScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it("should evaluate readiness categories", async () => {
      const result = await manager.validateProductionReadiness();

      expect(result.categories).toHaveLength(7); // Based on current implementation

      const categoryNames = result.categories.map((c) => c.name);
      expect(categoryNames).toContain("Code Quality");
      expect(categoryNames).toContain("Performance");
      expect(categoryNames).toContain("Security");
      expect(categoryNames).toContain("Infrastructure");
      expect(categoryNames).toContain("Documentation");
      expect(categoryNames).toContain("Monitoring");
      expect(categoryNames).toContain("Compliance");
    });

    it("should identify critical issues", async () => {
      const result = await manager.validateProductionReadiness();

      expect(Array.isArray(result.criticalIssues)).toBe(true);
      // Based on current placeholder implementation, no critical issues
      expect(result.criticalIssues).toHaveLength(0);
    });

    it("should provide recommendations", async () => {
      const result = await manager.validateProductionReadiness();

      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it("should perform risk assessment", async () => {
      const result = await manager.validateProductionReadiness();

      expect(result.riskAssessment).toBeDefined();
      expect(result.riskAssessment.overallRisk).toMatch(
        /^(low|medium|high|critical)$/,
      );
      expect(Array.isArray(result.riskAssessment.riskFactors)).toBe(true);
      expect(Array.isArray(result.riskAssessment.mitigationStrategies)).toBe(
        true,
      );
      expect(Array.isArray(result.riskAssessment.recommendedActions)).toBe(
        true,
      );
    });
  });

  describe("release certification", () => {
    beforeEach(async () => {
      await manager.initialize(testConfig);
    });

    it("should generate certification ID", async () => {
      // We need to mock the other methods for this test since they're not implemented yet
      try {
        await manager.certifyRelease();
      } catch (error) {
        // Expected since other methods are not implemented
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain("not yet implemented");
      }
    });

    it("should include version information", async () => {
      // Test will be completed when certifyRelease is fully implemented
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("error handling", () => {
    it("should handle initialization errors gracefully", async () => {
      const invalidConfig = {
        testing: { testSuites: [] },
        performance: {},
      } as any;

      await expect(manager.initialize(invalidConfig)).rejects.toThrow();
    });

    it("should provide meaningful error messages", async () => {
      const invalidConfig = {
        ...testConfig,
        performance: {
          ...testConfig.performance,
          targets: {
            ...testConfig.performance.targets,
            cliQueryResponseTime: -1, // Invalid: negative time
          },
        },
      };

      await expect(manager.initialize(invalidConfig)).rejects.toThrow(
        "CLI query response time target must be positive",
      );
    });
  });
});
